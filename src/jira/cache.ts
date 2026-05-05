import { dbOps } from "../db";

export function clearTixCache() {
  dbOps.deleteConfigLike("TIX_CACHE_%");
}
