const Ajv = require('ajv');
const ajv = new Ajv();

const GETSchema = {
  type: 'object',
  properties: {
    judge_id: {
      type: 'string',
      maxLength: 36
    }
  },
  required: ['judge_id'],
  additionalProperties: false
};

const POSTSchema = {
  type: 'object',
  properties: {
    sub_id: {
      type: 'integer'
    },
    prob_id: {
      type: 'integer'
    },
    file_provider: {
      type: 'string',
      maxLength: 256
    },
    sub_src_filename: {
      type: 'array',
      items: {
        type: 'string',
        maxLength: 256
      },
      minItems: 1,
      maxItems: 32,
      uniqueItems: true
    },
    sub_header_filename: {
      type: 'array',
      items: {
        type: 'string',
        maxLength: 256
      },
      maxItems: 32,
      uniqueItems: true
    },
    prob_src_filename: {
      type: 'array',
      items: {
        type: 'string',
        maxLength: 256
      },
      maxItems: 32,
      uniqueItems: true
    },
    prob_header_filename: {
      type: 'array',
      items: {
        type: 'string',
        maxLength: 256
      },
      maxItems: 32,
      uniqueItems: true
    },
    test_case_id: {
      type: 'array',
      items: {
        type: 'integer'
      },
      maxItems: 1024,
      uniqueItems: true
    },
    max_cpu_time: {
      type: 'integer',
      minimum: 0,
      maximum: 60 * 1000
    },
    max_memory: {
      type: 'integer',
      minimum: 0,
      maximum: 128 * 1024 * 1024
    }
  },
  required: ['sub_id', 'prob_id', 'file_provider', 'sub_src_filename'],
  additionalProperties: false
};

const validateGET = ajv.compile(GETSchema);
const validateDELETE = ajv.compile(GETSchema);
const validatePOST = ajv.compile(POSTSchema);

module.exports = {
  validateGET,
  validateDELETE,
  validatePOST
};