import type { Index } from "@pinecone-database/pinecone";

/**
 * The type of `Index.prototype.query` from Pinecone
 */
export type PineconeIndexQueryType = typeof Index.prototype.query;
