// Validate the subset of JSON Schema used by these tools before any page writes.
export function validate(schema, value, path = 'arguments') {
  const type = schema.type;
  const valid = type === 'object' ? value !== null && typeof value === 'object' && !Array.isArray(value)
    : type === 'array' ? Array.isArray(value)
    : type === 'integer' ? Number.isInteger(value)
    : type === 'number' ? typeof value === 'number' && Number.isFinite(value)
    : !type || typeof value === type;
  if (!valid) throw new Error(`${path} must be ${type}`);
  if (schema.enum && !schema.enum.includes(value)) throw new Error(`${path} must be one of: ${schema.enum.join(', ')}`);
  if (schema.minimum != null && value < schema.minimum) throw new Error(`${path} must be at least ${schema.minimum}`);
  if (schema.maximum != null && value > schema.maximum) throw new Error(`${path} must be at most ${schema.maximum}`);
  if (type === 'object') {
    for (const key of schema.required || []) if (!Object.hasOwn(value, key)) throw new Error(`${path}.${key} is required`);
    for (const key of Object.keys(value)) {
      if (Object.hasOwn(schema.properties || {}, key)) validate(schema.properties[key], value[key], `${path}.${key}`);
      else if (schema.additionalProperties === false) throw new Error(`Unknown ${path}.${key}`);
    }
  }
  if (type === 'array' && schema.items) value.forEach((v, i) => validate(schema.items, v, `${path}[${i}]`));
}
