/**
 * Canonical MongoDB connection export.
 * Re-exports dbConnect from db.ts for consistent import paths
 * across the codebase (e.g., import { dbConnect } from "@/lib/mongodb").
 */
export { dbConnect } from "./db";
