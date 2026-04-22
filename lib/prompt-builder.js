/**
 * Builds the provider-neutral LLM prompt and JSON schema.
 */

export const SYSTEM_PROMPT = `You are an expert marketing claims analyst with deep knowledge of product science, nutrition, dermatology, consumer electronics, and regulatory standards. Your job is to deeply analyze product pages in two phases.

**Phase 1 — Product Understanding**
Before evaluating any claims, build a thorough understanding of the product:
- Identify the product name, category/type (e.g. "dietary supplement", "skincare serum", "bluetooth speaker")
- Identify key ingredients, active compounds, or core technical components
- Determine the claimed mechanism of action — how does the product supposedly work?
- Assess the overall marketing tone of the page (clinical, hype-driven, balanced, fear-based, etc.)

Capture this understanding in the product_context object. This context will ground your claim evaluations.

**Phase 2 — Claim-by-Claim Evaluation**
For each marketing claim you find:
1. Extract the exact or near-exact claim text from the page
2. Classify it into a category (health, performance, environmental, safety, quality, value, scientific, testimonial, comparison, other)
3. Assign a verdict based on this product's specific ingredients/components/specs:
   - "supported" — Consistent with well-established science or evidence for this product type and its specific ingredients/components
   - "misleading" — Exaggerated, deceptively framed, or contradicts what is known about the product's actual ingredients/mechanism
   - "unverified" — Plausible but requires specific clinical evidence that cannot be confirmed from general knowledge
4. Write a short user-friendly explanation (1 sentence) summarizing your verdict
5. Write a detailed reasoning (2-3 sentences) explaining the scientific or factual basis for the verdict, referencing specific ingredients, components, or product characteristics

Your reasoning must be product-specific. Do NOT write generic evaluations like "this is a common marketing claim." Instead, reference the actual ingredients, specs, or mechanism. For example: "This supplement contains 500mg of Vitamin C as ascorbic acid, which has strong evidence for immune support at this dosage, though 'boosts immunity' overstates the effect — evidence supports reduced duration of colds, not prevention."

Focus on substantive marketing claims. Skip obvious product descriptions (color, size, material), pricing, and shipping details. Look for claims about effectiveness, health benefits, superiority, environmental impact, scientific backing, and quantified performance.

If the page contains no identifiable marketing claims, return an empty claims array.`;

export const CLAIMS_JSON_SCHEMA = {
  type: 'object',
  properties: {
    product_context: {
      type: 'object',
      description: 'Deep understanding of the product before evaluating claims',
      properties: {
        product_name: {
          type: 'string',
          description: 'The name of the product as shown on the page',
        },
        product_type: {
          type: 'string',
          description: 'Category of product, e.g. "dietary supplement", "skincare serum", "bluetooth speaker", "running shoe"',
        },
        key_ingredients: {
          type: 'string',
          description: 'Active ingredients, core components, key specs, or "N/A" for products where this does not apply',
        },
        claimed_mechanism: {
          type: 'string',
          description: 'How the product supposedly works based on the page claims',
        },
        overall_impression: {
          type: 'string',
          description: '1-2 sentence assessment of the marketing tone and credibility of the page',
        },
      },
      required: ['product_name', 'product_type', 'key_ingredients', 'claimed_mechanism', 'overall_impression'],
      additionalProperties: false,
    },
    page_summary: {
      type: 'string',
      description: 'One-sentence summary of what the product/page is about',
    },
    claims: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          claim_text: {
            type: 'string',
            description: 'The marketing claim as stated or closely paraphrased from the page',
          },
          verdict: {
            type: 'string',
            enum: ['supported', 'misleading', 'unverified'],
          },
          explanation: {
            type: 'string',
            description: 'Short user-friendly summary of the verdict (1 sentence)',
          },
          reasoning: {
            type: 'string',
            description: 'Detailed scientific/factual basis for the verdict (2-3 sentences), referencing specific ingredients, components, or product characteristics',
          },
          category: {
            type: 'string',
            enum: [
              'health',
              'performance',
              'environmental',
              'safety',
              'quality',
              'value',
              'scientific',
              'testimonial',
              'comparison',
              'other',
            ],
          },
        },
        required: ['claim_text', 'verdict', 'explanation', 'reasoning', 'category'],
        additionalProperties: false,
      },
    },
  },
  required: ['product_context', 'page_summary', 'claims'],
  additionalProperties: false,
};

/**
 * Build the user prompt for a page analysis request.
 * @param {string} pageContent - Extracted text from the product page
 * @param {object} [options] - Optional config
 * @param {string} [options.researchContext] - Additional context from live research (future)
 * @returns {string}
 */
export function buildUserPrompt(pageContent, options = {}) {
  let userContent = `Analyze the following product page content and identify all marketing claims:\n\n---\n${pageContent}\n---`;

  if (options.researchContext) {
    userContent += `\n\nAdditional research context:\n${options.researchContext}`;
  }

  return userContent;
}

/**
 * Build the messages array and OpenAI response format wrapper.
 * @param {string} pageContent
 * @param {object} [options]
 * @returns {{ messages: Array, responseFormat: object }}
 */
export function buildPrompt(pageContent, options = {}) {
  return {
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(pageContent, options) },
    ],
    responseFormat: {
      type: 'json_schema',
      json_schema: {
        name: 'claims_analysis',
        strict: true,
        schema: CLAIMS_JSON_SCHEMA,
      },
    },
  };
}
