/** @typedef {'quark'|'aliyun'|'baidu'|'xunlei'|'pan123'|'tianyi'|'pan115'|'uc'|'mobile'|'lanzou'|'magnet'} CloudType */

/**
 * @typedef {Object} SearchHit
 * @property {string} id
 * @property {string} title
 * @property {string} url
 * @property {string} [password]
 * @property {CloudType} cloudType
 * @property {number} score
 * @property {string} source
 * @property {string} [datetime]
 * @property {string} [note]
 * @property {number} [sizeBytes]
 * @property {number} [fileCount]
 * @property {boolean} [metaPartial]
 */

/**
 * @typedef {Object} SearchResponse
 * @property {string} query
 * @property {boolean} demoMode
 * @property {string} modeLabel
 * @property {number} total
 * @property {SearchHit[]} results
 * @property {CloudType[]} cloudTypes
 * @property {number} tookMs
 */

export {};
