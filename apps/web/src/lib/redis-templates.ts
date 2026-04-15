const quoteRedisKey = (key: string): string =>
  /[\s"'`\\]/.test(key) ? `"${key.replaceAll('"', '\\"')}"` : key;

export const redisInspectCommand = (key: string, kind: string): string => {
  const k = quoteRedisKey(key);
  switch (kind.toUpperCase()) {
    case "STRING": {
      return `GET ${k}`;
    }
    case "HASH": {
      return `HGETALL ${k}`;
    }
    case "LIST": {
      return `LRANGE ${k} 0 99`;
    }
    case "SET": {
      return `SMEMBERS ${k}`;
    }
    case "ZSET": {
      return `ZRANGE ${k} 0 99 WITHSCORES`;
    }
    case "STREAM": {
      return `XRANGE ${k} - + COUNT 100`;
    }
    default: {
      return `TYPE ${k}`;
    }
  }
};

export const redisTypeCommand = (key: string): string =>
  `TYPE ${quoteRedisKey(key)}`;

export const redisTtlCommand = (key: string): string =>
  `TTL ${quoteRedisKey(key)}`;

export const redisDeleteCommand = (key: string): string =>
  `DEL ${quoteRedisKey(key)}`;
