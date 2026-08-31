/**
 * Linewatch DNS codec
 * Copyright (c) 2026 Chris Decker
 *
 * Domain-level only. Parse a query, write A / AAAA / NXDOMAIN / sinkhole answers.
 */
import { Buffer } from "node:buffer";

export const TYPE_A = 1;
export const TYPE_AAAA = 28;
export const TYPE_CNAME = 5;
export const TYPE_HTTPS = 65;

export function decodeQuery(buf) {
  if (!Buffer.isBuffer(buf)) buf = Buffer.from(buf);
  if (buf.length < 12) return null;
  const id = buf.readUInt16BE(0);
  const flags = buf.readUInt16BE(2);
  const qd = buf.readUInt16BE(4);
  if (qd < 1) return null;
  let off = 12;
  const labels = [];
  for (let n = 0; n < 40 && off < buf.length; n++) {
    const len = buf[off];
    if (len === 0) {
      off += 1;
      break;
    }
    if ((len & 0xc0) === 0xc0) return null;
    if (len > 63) return null;
    off += 1;
    if (off + len > buf.length) return null;
    labels.push(buf.slice(off, off + len).toString("ascii").toLowerCase());
    off += len;
  }
  if (off + 4 > buf.length) return null;
  const qtype = buf.readUInt16BE(off);
  const qclass = buf.readUInt16BE(off + 2);
  const name = labels.join(".");
  if (!name) return null;
  return { id, flags, name, qtype, qclass, question: buf.slice(12, off + 4) };
}

function writeName(parts) {
  const chunks = [];
  for (const p of parts) {
    const b = Buffer.from(p, "ascii");
    chunks.push(Buffer.from([b.length]), b);
  }
  chunks.push(Buffer.from([0]));
  return Buffer.concat(chunks);
}

function ipv4ToBuf(ip) {
  const p = ip.split(".").map((n) => Number(n) & 255);
  if (p.length !== 4) return Buffer.from([0, 0, 0, 0]);
  return Buffer.from(p);
}

function ipv6ToBuf(ip) {
  if (ip === "::" || ip === "0:0:0:0:0:0:0:0") return Buffer.alloc(16);
  const buf = Buffer.alloc(16);
  return buf;
}

/**
 * @param {{ id: number, question: Buffer }} query
 * @param {{ rcode?: number, answers?: { type: number, ttl?: number, ip?: string, cname?: string }[] }} opts
 */
export function encodeResponse(query, opts = {}) {
  const rcode = opts.rcode ?? 0;
  const answers = opts.answers ?? [];
  const flags = 0x8180 | (rcode & 0xf); // QR RD RA
  const header = Buffer.alloc(12);
  header.writeUInt16BE(query.id, 0);
  header.writeUInt16BE(flags, 2);
  header.writeUInt16BE(1, 4);
  header.writeUInt16BE(answers.length, 6);
  const rr = [];
  for (const a of answers) {
    const namePtr = Buffer.from([0xc0, 0x0c]);
    const ttl = a.ttl ?? 30;
    let rdata;
    const type = a.type ?? TYPE_A;
    if (type === TYPE_CNAME && a.cname) {
      rdata = writeName(a.cname.split("."));
    } else if (type === TYPE_AAAA) {
      rdata = ipv6ToBuf(a.ip || "::");
    } else {
      rdata = ipv4ToBuf(a.ip || "0.0.0.0");
    }
    const mid = Buffer.alloc(10);
    mid.writeUInt16BE(type, 0);
    mid.writeUInt16BE(1, 2);
    mid.writeUInt32BE(ttl, 4);
    mid.writeUInt16BE(rdata.length, 8);
    rr.push(namePtr, mid, rdata);
  }
  return Buffer.concat([header, query.question, ...rr]);
}

export function sinkhole(query) {
  if (query.qtype === TYPE_AAAA) {
    return encodeResponse(query, { answers: [{ type: TYPE_AAAA, ip: "::", ttl: 20 }] });
  }
  if (query.qtype === TYPE_A || query.qtype === TYPE_HTTPS) {
    return encodeResponse(query, {
      answers: query.qtype === TYPE_A ? [{ type: TYPE_A, ip: "0.0.0.0", ttl: 20 }] : [],
    });
  }
  return encodeResponse(query, { answers: [] });
}

export function answerA(query, ip, ttl = 30) {
  if (query.qtype === TYPE_AAAA) return encodeResponse(query, { answers: [] });
  if (query.qtype !== TYPE_A) return encodeResponse(query, { answers: [] });
  return encodeResponse(query, { answers: [{ type: TYPE_A, ip, ttl }] });
}
