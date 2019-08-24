/**
 * @param {any} obj The object to inspect.
 * @returns {boolean} True if the argument appears to be a plain object.
 */
export default function isPlainObject(obj) {
  if (typeof obj !== 'object' || obj === null) return false

  let proto = obj
  while (Object.getPrototypeOf(proto) !== null) { // Object.getPrototypeOf(xxx) 相当于 xxx.__proto__ 相当于 constructor.prototype
    proto = Object.getPrototypeOf(proto)
  }
  // 循环结束之后 proto 为 Object.prototype（因为 Object.prototype.__proto__ = null)
  return Object.getPrototypeOf(obj) === proto
}
