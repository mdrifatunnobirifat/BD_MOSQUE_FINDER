"""Build mosques.js for the Bangladesh Mosque Finder.

Reads only the places-of-worship layers from Geofabrik's Bangladesh shapefile zip
using HTTP range requests (no need to download the full ~1 GB archive), keeps
fclass == 'muslim', and writes  window.MOSQUES = [[lat, lon, "name"], ...].
Standard library only.
"""
import io, json, struct, sys, urllib.request, zipfile

URL = "https://download.geofabrik.de/asia/bangladesh-latest-free.shp.zip"
OUT = sys.argv[1] if len(sys.argv) > 1 else "mosques.js"
UA = {"User-Agent": "bd-mosque-finder-build/1.0"}


class HttpRangeFile(io.RawIOBase):
    def __init__(self, url):
        req = urllib.request.Request(url, method="HEAD", headers=UA)
        with urllib.request.urlopen(req) as r:
            self.url = r.geturl()  # follow redirect to dated file
            self.size = int(r.headers["Content-Length"])
        self.pos = 0

    def seekable(self): return True
    def readable(self): return True
    def tell(self): return self.pos

    def seek(self, off, whence=0):
        self.pos = {0: off, 1: self.pos + off, 2: self.size + off}[whence]
        return self.pos

    def read(self, n=-1):
        if n is None or n < 0: n = self.size - self.pos
        if n == 0 or self.pos >= self.size: return b""
        end = min(self.pos + n, self.size) - 1
        req = urllib.request.Request(self.url, headers={**UA, "Range": f"bytes={self.pos}-{end}"})
        with urllib.request.urlopen(req) as r:
            data = r.read()
        self.pos += len(data)
        return data

    def readinto(self, b):
        d = self.read(len(b)); b[:len(d)] = d; return len(d)


def read_dbf(buf):
    n, hlen, rlen = struct.unpack("<xxxxIHH", buf[:12])
    fields, off = [], 32
    while buf[off] != 0x0D:
        name = buf[off:off + 11].split(b"\0")[0].decode()
        fields.append((name, buf[off + 16]))
        off += 32
    rows = []
    for i in range(n):
        rec = buf[hlen + i * rlen: hlen + (i + 1) * rlen]
        p, row = 1, {}
        for name, ln in fields:
            row[name] = rec[p:p + ln].decode("utf-8", "replace").strip(); p += ln
        rows.append(row)
    return rows


def read_shp_centers(buf):
    """Yield (lon, lat) per record: point coords, or bbox centre for polygons."""
    pos, out = 100, []
    while pos < len(buf):
        _, clen = struct.unpack(">ii", buf[pos:pos + 8])
        content = buf[pos + 8: pos + 8 + clen * 2]
        stype = struct.unpack("<i", content[:4])[0]
        if stype == 1:
            out.append(struct.unpack("<dd", content[4:20]))
        elif stype in (5, 15, 25):
            xmin, ymin, xmax, ymax = struct.unpack("<dddd", content[4:36])
            out.append(((xmin + xmax) / 2, (ymin + ymax) / 2))
        else:
            out.append(None)
        pos += 8 + clen * 2
    return out


def main():
    f = io.BufferedReader(HttpRangeFile(URL), buffer_size=1 << 16)
    z = zipfile.ZipFile(f)
    print("Archive:", f.raw.url)
    mosques, seen = [], set()
    for layer in ("gis_osm_pofw_free_1", "gis_osm_pofw_a_free_1"):
        shp, dbf = z.read(layer + ".shp"), z.read(layer + ".dbf")
        rows, pts = read_dbf(dbf), read_shp_centers(shp)
        kept = 0
        for row, pt in zip(rows, pts):
            if row.get("fclass") != "muslim" or pt is None or row["osm_id"] in seen:
                continue
            seen.add(row["osm_id"])
            mosques.append([round(pt[1], 6), round(pt[0], 6), row.get("name", "")])
            kept += 1
        print(f"{layer}: {kept} mosques")
    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write("// Generated from OpenStreetMap data (c) OpenStreetMap contributors, ODbL. Source: Geofabrik.\n")
        fh.write("window.MOSQUES = ")
        json.dump(mosques, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write(";\n")
    print("Total:", len(mosques), "->", OUT)


if __name__ == "__main__":
    main()

