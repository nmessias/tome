import { lookup } from "node:dns/promises";
import {
  createConnection,
  createServer,
  isIP,
  type Socket,
} from "node:net";

const LISTEN_HOST = "127.0.0.1";
const LISTEN_PORT = 1056;
const UPSTREAM_HOST = "127.0.0.1";
const UPSTREAM_PORT = 1055;
const HANDSHAKE_TIMEOUT_MS = 10_000;

interface ResolvedAddress {
  type: 1 | 4;
  bytes: Buffer;
}

class HostLookupError extends Error {
  constructor(hostname: string, cause: unknown) {
    super("lookup " + hostname + ": " + String(cause));
  }
}

function readExactly(socket: Socket, length: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      socket.removeListener("readable", onReadable);
      socket.removeListener("end", onEnd);
      socket.removeListener("close", onClose);
      socket.removeListener("error", onError);
    };

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const onReadable = () => {
      const chunk = socket.read(length) as Buffer | null;
      if (!chunk) return;
      settled = true;
      cleanup();
      resolve(chunk);
    };

    const onEnd = () => fail(new Error("Socket ended during SOCKS handshake"));
    const onClose = () => fail(new Error("Socket closed during SOCKS handshake"));
    const onError = (error: Error) => fail(error);

    socket.on("readable", onReadable);
    socket.once("end", onEnd);
    socket.once("close", onClose);
    socket.once("error", onError);
    onReadable();
  });
}

function ipv6Bytes(address: string): Buffer {
  const halves = address.toLowerCase().split("::");
  if (halves.length > 2) throw new Error("Invalid IPv6 address: " + address);

  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const zeroCount = 8 - left.length - right.length;

  if (zeroCount < 0 || (halves.length === 1 && zeroCount !== 0)) {
    throw new Error("Invalid IPv6 address: " + address);
  }

  const groups = [
    ...left,
    ...Array(zeroCount).fill("0"),
    ...right,
  ];
  const bytes = groups.flatMap((group) => {
    const value = parseInt(group, 16);
    if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
      throw new Error("Invalid IPv6 address: " + address);
    }
    return [value >> 8, value & 0xff];
  });

  if (bytes.length !== 16) throw new Error("Invalid IPv6 address: " + address);
  return Buffer.from(bytes);
}

async function resolveAddress(
  type: number,
  encodedAddress: Buffer
): Promise<ResolvedAddress> {
  if (type === 1 || type === 4) {
    return { type, bytes: encodedAddress };
  }

  if (type !== 3 || encodedAddress.length === 0) {
    throw new Error("Unsupported SOCKS address type");
  }

  const hostname = encodedAddress.toString("utf8");
  try {
    const addresses = await lookup(hostname, { all: true });
    const address =
      addresses.find((record) => record.family === 4) ?? addresses[0];

    if (!address) throw new Error("No IP addresses returned");

    if (address.family === 4) {
      return {
        type: 1,
        bytes: Buffer.from(address.address.split(".").map(Number)),
      };
    }

    if (address.family === 6) {
      return { type: 4, bytes: ipv6Bytes(address.address) };
    }

    throw new Error("Unsupported address family");
  } catch (error) {
    throw new HostLookupError(hostname, error);
  }
}

function connectUpstream(): Promise<Socket> {
  const socket = createConnection({
    host: UPSTREAM_HOST,
    port: UPSTREAM_PORT,
  });

  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => socket.destroy(new Error("Tailscale SOCKS connection timed out")),
      HANDSHAKE_TIMEOUT_MS
    );

    const cleanup = () => {
      clearTimeout(timer);
      socket.removeListener("connect", onConnect);
      socket.removeListener("error", onError);
    };

    const onConnect = () => {
      cleanup();
      socket.setTimeout(
        HANDSHAKE_TIMEOUT_MS,
        () => socket.destroy(new Error("Tailscale SOCKS handshake timed out"))
      );
      resolve(socket);
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    socket.once("connect", onConnect);
    socket.once("error", onError);
  });
}

async function readSocksReply(socket: Socket): Promise<Buffer> {
  const header = await readExactly(socket, 4);
  if (header[0] !== 5 || header[2] !== 0) {
    throw new Error("Invalid SOCKS5 response");
  }

  let addressPrefix = Buffer.alloc(0);
  let addressLength: number;

  if (header[3] === 1) {
    addressLength = 4;
  } else if (header[3] === 4) {
    addressLength = 16;
  } else if (header[3] === 3) {
    addressPrefix = await readExactly(socket, 1);
    addressLength = addressPrefix[0];
  } else {
    throw new Error("Invalid SOCKS5 response address type");
  }

  const addressAndPort = await readExactly(socket, addressLength + 2);
  return Buffer.concat([header, addressPrefix, addressAndPort]);
}

function failureReply(code: number): Buffer {
  return Buffer.from([5, code, 0, 1, 0, 0, 0, 0, 0, 0]);
}

async function handleClient(client: Socket): Promise<void> {
  let mayReply = false;
  let upstream: Socket | undefined;
  let tunnelEstablished = false;

  client.setNoDelay(true);
  client.setTimeout(
    HANDSHAKE_TIMEOUT_MS,
    () => client.destroy(new Error("SOCKS client handshake timed out"))
  );
  client.on("error", () => upstream?.destroy());
  client.once("close", () => upstream?.destroy());

  try {
    const greeting = await readExactly(client, 2);
    if (greeting[0] !== 5 || greeting[1] === 0) {
      client.end(Buffer.from([5, 0xff]));
      return;
    }

    const methods = await readExactly(client, greeting[1]);

    if (!methods.includes(0)) {
      client.end(Buffer.from([5, 0xff]));
      return;
    }

    client.write(Buffer.from([5, 0]));
    mayReply = true;

    const request = await readExactly(client, 4);
    if (request[0] !== 5 || request[2] !== 0) {
      throw new Error("Invalid SOCKS5 request");
    }
    if (request[1] !== 1) {
      client.end(failureReply(7));
      return;
    }

    let encodedAddress: Buffer;
    if (request[3] === 1) {
      encodedAddress = await readExactly(client, 4);
    } else if (request[3] === 4) {
      encodedAddress = await readExactly(client, 16);
    } else if (request[3] === 3) {
      const length = await readExactly(client, 1);
      encodedAddress = await readExactly(client, length[0]);
    } else {
      throw new Error("Unsupported SOCKS address type");
    }

    const port = await readExactly(client, 2);
    const address = await resolveAddress(request[3], encodedAddress);

    upstream = await connectUpstream();
    upstream.write(Buffer.from([5, 1, 0]));
    const method = await readExactly(upstream, 2);
    if (method[0] !== 5 || method[1] !== 0) {
      throw new Error("Tailscale SOCKS proxy rejected no-auth mode");
    }

    upstream.write(
      Buffer.concat([
        Buffer.from([5, 1, 0, address.type]),
        address.bytes,
        port,
      ])
    );

    const reply = await readSocksReply(upstream);
    if (reply[1] !== 0) {
      client.end(reply);
      return;
    }

    client.setTimeout(0);
    upstream.setTimeout(0);
    upstream.on("error", () => client.destroy());
    client.write(reply);
    client.pipe(upstream);
    upstream.pipe(client);
    tunnelEstablished = true;
  } catch (error) {
    if (error instanceof HostLookupError) {
      console.warn("[SOCKS bridge] " + error.message);
    }
    if (mayReply && !client.destroyed) {
      client.end(failureReply(error instanceof HostLookupError ? 4 : 1));
    } else {
      client.destroy();
    }
  } finally {
    if (!tunnelEstablished) upstream?.destroy();
  }
}

const server = createServer((client) => {
  void handleClient(client);
});

server.maxConnections = 100;
server.on("error", (error) => {
  console.error("[SOCKS bridge] Server error:", error.message);
  process.exitCode = 1;
});
server.listen(LISTEN_PORT, LISTEN_HOST, () => {
  console.log(
    "[SOCKS bridge] listening on " +
      LISTEN_HOST +
      ":" +
      LISTEN_PORT +
      "; upstream " +
      UPSTREAM_HOST +
      ":" +
      UPSTREAM_PORT
  );
});
