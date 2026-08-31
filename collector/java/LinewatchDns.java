/**
 * Linewatch house DNS — Java
 * Copyright (c) 2026 Chris Decker
 *
 * javac collector/java/LinewatchDns.java && java -cp collector/java LinewatchDns
 *
 * Domain-level filter: adult / VPN / DGA entropy / safe-search rewrite.
 * Writes data/logs.jsonl in the same schema as the Node collector.
 */
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.Executors;

public class LinewatchDns {
  static final Set<String> ADULT = new HashSet<>(Arrays.asList(
      "pornhub.com", "xvideos.com", "xnxx.com", "xhamster.com", "onlyfans.com", "chaturbate.com"));
  static final Set<String> VPN = new HashSet<>(Arrays.asList(
      "dns.google", "cloudflare-dns.com", "nordvpn.com", "expressvpn.com", "protonvpn.com",
      "mask.icloud.com", "mask-h2.icloud.com"));
  static Path dataDir = Paths.get(System.getenv().getOrDefault("LINEWATCH_DATA", "data"));
  static int dnsPort = Integer.parseInt(System.getenv().getOrDefault("LINEWATCH_DNS_PORT", "53"));
  static int httpPort = Integer.parseInt(System.getenv().getOrDefault("LINEWATCH_PORT", "8787"));
  static String upstream = System.getenv().getOrDefault("LINEWATCH_UPSTREAM", "1.1.1.1");

  static String normalize(String host) {
    String h = host.trim().toLowerCase(Locale.ROOT);
    if (h.endsWith(".")) h = h.substring(0, h.length() - 1);
    if (h.startsWith("www.")) h = h.substring(4);
    return h;
  }

  static boolean matches(String host, Set<String> names) {
    String h = normalize(host);
    for (String n : names) {
      if (h.equals(n) || h.endsWith("." + n)) return true;
    }
    return false;
  }

  static double entropy(String s) {
    if (s.isEmpty()) return 0;
    Map<Character, Integer> freq = new HashMap<>();
    for (char c : s.toCharArray()) freq.merge(c, 1, Integer::sum);
    double h = 0;
    int n = s.length();
    for (int c : freq.values()) {
      double p = c / (double) n;
      h -= p * (Math.log(p) / Math.log(2));
    }
    return h;
  }

  static String classify(String host) {
    if (matches(host, ADULT)) return "adult";
    if (matches(host, VPN)) return "vpn";
    return "unknown";
  }

  static boolean dga(String host) {
    String[] parts = normalize(host).split("\\.");
    String label = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
    return label.length() >= 10 && entropy(label) >= 3.5;
  }

  static String decide(String host, String ip) {
    String cat = classify(host);
    if (matches(host, ADULT) || "adult".equals(cat)) return "blocked|global-adult|" + cat;
    if (matches(host, VPN)) return "blocked|vpn-doh|vpn";
    if (dga(host)) return "blocked|dga-entropy|unknown";
    String h = normalize(host);
    if (h.equals("google.com") || h.equals("www.google.com")) return "rewritten|safe-search|search|216.239.38.120";
    if (h.equals("youtube.com") || h.equals("www.youtube.com")) return "rewritten|safe-search|search|216.239.38.119";
    return "allowed|ok|" + cat;
  }

  static void appendLog(String host, String ip, String decision) throws IOException {
    Files.createDirectories(dataDir);
    String[] p = decision.split("\\|");
    String json = "{\"ts\":" + Instant.now().toEpochMilli()
        + ",\"deviceMac\":\"\",\"sourceIp\":\"" + ip
        + "\",\"requestedDomain\":\"" + host
        + "\",\"category\":\"" + (p.length > 2 ? p[2] : "unknown")
        + "\",\"action\":\"" + p[0] + "\",\"reason\":\"" + (p.length > 1 ? p[1] : "ok") + "\"}\n";
    Files.write(dataDir.resolve("logs.jsonl"), json.getBytes(StandardCharsets.UTF_8),
        StandardOpenOption.CREATE, StandardOpenOption.APPEND);
  }

  static String decodeName(byte[] buf, int[] off) {
    StringBuilder sb = new StringBuilder();
    int o = off[0];
    while (o < buf.length) {
      int n = buf[o] & 0xff;
      if (n == 0) {
        off[0] = o + 1;
        break;
      }
      if ((n & 0xc0) == 0xc0) {
        off[0] = o + 2;
        break;
      }
      o++;
      if (sb.length() > 0) sb.append('.');
      sb.append(new String(buf, o, n, StandardCharsets.US_ASCII));
      o += n;
    }
    return sb.toString().toLowerCase(Locale.ROOT);
  }

  static byte[] sinkhole(byte[] query, String ip) {
    int[] off = new int[] {12};
    decodeName(query, off);
    int qend = Math.min(off[0] + 4, query.length);
    byte[] question = Arrays.copyOfRange(query, 12, qend);
    byte[] out = new byte[12 + question.length + 16];
    System.arraycopy(query, 0, out, 0, 2);
    out[2] = (byte) 0x81;
    out[3] = (byte) 0x80;
    out[4] = 0;
    out[5] = 1;
    out[6] = 0;
    out[7] = 1;
    System.arraycopy(question, 0, out, 12, question.length);
    int p = 12 + question.length;
    out[p] = (byte) 0xc0;
    out[p + 1] = 0x0c;
    out[p + 2] = 0;
    out[p + 3] = 1;
    out[p + 4] = 0;
    out[p + 5] = 1;
    out[p + 6] = 0;
    out[p + 7] = 0;
    out[p + 8] = 0;
    out[p + 9] = 30;
    out[p + 10] = 0;
    out[p + 11] = 4;
    String[] oct = ip.split("\\.");
    for (int i = 0; i < 4; i++) out[p + 12 + i] = (byte) Integer.parseInt(oct[i]);
    return out;
  }

  static byte[] forward(byte[] query) {
    try (DatagramSocket s = new DatagramSocket()) {
      s.setSoTimeout(1400);
      s.send(new DatagramPacket(query, query.length, InetAddress.getByName(upstream), 53));
      byte[] buf = new byte[4096];
      DatagramPacket in = new DatagramPacket(buf, buf.length);
      s.receive(in);
      return Arrays.copyOf(in.getData(), in.getLength());
    } catch (Exception e) {
      return null;
    }
  }

  static void startHttp() throws IOException {
    HttpServer http = HttpServer.create(new InetSocketAddress("0.0.0.0", httpPort), 0);
    http.createContext("/status", (HttpExchange ex) -> {
      int n = 0;
      try {
        if (Files.exists(dataDir.resolve("logs.jsonl"))) {
          n = Files.readAllLines(dataDir.resolve("logs.jsonl")).size();
        }
      } catch (IOException ignored) { }
      String json = "{\"ok\":true,\"service\":\"linewatch-collector\",\"runtime\":\"java\",\"alwaysOn\":true,\"retentionDays\":7,\"dns\":true,\"eventCount\":" + n + "}";
      sendJson(ex, json);
    });
    http.createContext("/events", (HttpExchange ex) -> {
      StringBuilder sb = new StringBuilder("{\"events\":[");
      boolean first = true;
      try {
        if (Files.exists(dataDir.resolve("logs.jsonl"))) {
          for (String line : Files.readAllLines(dataDir.resolve("logs.jsonl"))) {
            if (line.isBlank()) continue;
            String host = extract(line, "requestedDomain");
            if (host.isEmpty()) host = extract(line, "host");
            String ip = extract(line, "sourceIp");
            String cat = extract(line, "category");
            String action = extract(line, "action");
            String reason = extract(line, "reason");
            String ts = extractNumber(line, "ts");
            if (!first) sb.append(',');
            first = false;
            sb.append("{\"ts\":").append(ts.isEmpty() ? "0" : ts)
                .append(",\"sourceIp\":\"").append(esc(ip))
                .append("\",\"host\":\"").append(esc(host))
                .append("\",\"category\":\"").append(esc(cat))
                .append("\",\"action\":\"").append(esc(action))
                .append("\",\"reason\":\"").append(esc(reason)).append("\"}");
          }
        }
      } catch (IOException ignored) { }
      sb.append("]}");
      sendJson(ex, sb.toString());
    });
    http.setExecutor(Executors.newCachedThreadPool());
    http.start();
    System.out.println("Linewatch Java API on " + httpPort);
  }

  static void sendJson(HttpExchange ex, String json) throws IOException {
    byte[] body = json.getBytes(StandardCharsets.UTF_8);
    ex.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
    ex.getResponseHeaders().add("Content-Type", "application/json");
    ex.sendResponseHeaders(200, body.length);
    ex.getResponseBody().write(body);
    ex.close();
  }

  static String extract(String json, String key) {
    String needle = "\"" + key + "\":\"";
    int i = json.indexOf(needle);
    if (i < 0) return "";
    int s = i + needle.length();
    int e = json.indexOf('"', s);
    return e > s ? json.substring(s, e) : "";
  }

  static String extractNumber(String json, String key) {
    String needle = "\"" + key + "\":";
    int i = json.indexOf(needle);
    if (i < 0) return "";
    int s = i + needle.length();
    int e = s;
    while (e < json.length() && Character.isDigit(json.charAt(e))) e++;
    return json.substring(s, e);
  }

  static String esc(String s) {
    return s.replace("\\", "\\\\").replace("\"", "\\\"");
  }

  public static void main(String[] args) throws Exception {
    startHttp();
    DatagramSocket sock;
    try {
      sock = new DatagramSocket(new InetSocketAddress("0.0.0.0", dnsPort));
      System.out.println("House DNS on " + dnsPort);
    } catch (BindException e) {
      int fb = Integer.parseInt(System.getenv().getOrDefault("LINEWATCH_DNS_FALLBACK", "5353"));
      sock = new DatagramSocket(new InetSocketAddress("0.0.0.0", fb));
      System.out.println("House DNS fallback " + fb + " — run as administrator for the house resolver");
    }
    System.out.println("Chris Decker · Linewatch Java collector");
    byte[] buf = new byte[4096];
    while (true) {
      DatagramPacket pkt = new DatagramPacket(buf, buf.length);
      sock.receive(pkt);
      byte[] data = Arrays.copyOf(pkt.getData(), pkt.getLength());
      int[] off = new int[] {12};
      String name = decodeName(data, off);
      if (name.isEmpty()) continue;
      String ip = pkt.getAddress().getHostAddress();
      String d = decide(name, ip);
      appendLog(name, ip, d);
      byte[] reply;
      if (d.startsWith("blocked")) reply = sinkhole(data, "0.0.0.0");
      else if (d.startsWith("rewritten")) {
        String[] p = d.split("\\|");
        reply = sinkhole(data, p.length > 3 ? p[3] : "0.0.0.0");
      } else {
        byte[] up = forward(data);
        reply = up != null ? up : sinkhole(data, "0.0.0.0");
      }
      sock.send(new DatagramPacket(reply, reply.length, pkt.getAddress(), pkt.getPort()));
    }
  }
}
