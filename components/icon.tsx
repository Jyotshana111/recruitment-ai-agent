import type { CSSProperties } from "react";
type Name = "spark" | "file" | "upload" | "arrow" | "check" | "clock" | "close" | "save" | "download" | "refresh" | "plus" | "chat";
const paths: Record<Name, string> = {
  spark: "M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z",
  file: "M14 3H5v18h14V8l-5-5Zm0 0v5h5M8 12h8M8 16h6",
  upload: "M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  check: "m5 12 4 4L19 6",
  clock: "M12 8v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  close: "m6 6 12 12M6 18 18 6",
  save: "M19 21H5V3h12l3 3v15M8 3v6h8V3M8 21v-8h8v8",
  download: "M12 3v13m-5-5 5 5 5-5M4 18v3h16v-3",
  refresh: "M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1",
  plus: "M12 5v14M5 12h14",
  chat: "M4 4h16v13H9l-5 4V4M8 8h8M8 12h5",
};
export function Icon({ name, size = 20, style }: { name: Name; size?: number; style?: CSSProperties }) {
  return <svg width={size} height={size} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
