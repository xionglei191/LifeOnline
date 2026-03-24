/**
 * Embedding — AI-powered text-to-vector conversion
 *
 * Calls the `/v1/embeddings` endpoint (OpenAI-compatible) to generate
 * dense vector representations of text. Used for semantic search via sqlite-vec.
 */
import { getEffectiveAiProviderConfig } from './providerConfigService.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('embedding');

const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';

function getEmbeddingModel(): string {
  return process.env.EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;
}

/**
 * Derive the embeddings endpoint from the configured base URL.
 * If baseUrl ends with `/v1/messages`, replace with `/v1/embeddings`.
 * Otherwise append `/v1/embeddings`.
 */
function getEmbeddingsEndpoint(baseUrl: string): string {
  if (baseUrl.endsWith('/v1/messages')) {
    return baseUrl.replace('/v1/messages', '/v1/embeddings');
  }
  if (baseUrl.endsWith('/v1/chat/completions')) {
    return baseUrl.replace('/v1/chat/completions', '/v1/embeddings');
  }
  // If it's just the base domain, append the standard path
  const url = new URL(baseUrl);
  url.pathname = '/v1/embeddings';
  return url.toString();
}

export interface EmbeddingResponse {
  object: string;
  data: Array<{
    object: string;
    index: number;
    embedding: number[];
  }>;
  model: string;
  usage?: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

/**
 * Generate an embedding vector for the given text.
 * Returns a float[] vector suitable for storage in sqlite-vec.
 *
 * @throws Error if the API call fails or returns unexpected data
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const config = getEffectiveAiProviderConfig();
  const endpoint = getEmbeddingsEndpoint(config.baseUrl);
  const model = getEmbeddingModel();

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: text,
      encoding_format: 'float',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Embedding API error: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as EmbeddingResponse;

  if (!data.data?.[0]?.embedding) {
    throw new Error('Embedding API returned unexpected format');
  }

  const embedding = data.data[0].embedding;
  logger.info(`Generated embedding (dim=${embedding.length}, model=${model})`);
  return embedding;
}

/**
 * Generate embeddings for multiple texts in a single batch call.
 */
export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const config = getEffectiveAiProviderConfig();
  const endpoint = getEmbeddingsEndpoint(config.baseUrl);
  const model = getEmbeddingModel();

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: texts,
      encoding_format: 'float',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Embedding API error: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as EmbeddingResponse;
  return data.data
    .sort((a, b) => a.index - b.index)
    .map(item => item.embedding);
}
