function assert(value: unknown, message = "Assertion failed"): asserts value {
  if (!value) {
    throw new Error(message);
  }
}

const ok = assert;

export { assert, ok };
export default assert;
