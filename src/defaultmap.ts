/**
 * Map class with a callback function that creates a default value
 * instead of returning an undefined value.
 * A default value can not be used as it would always return
 * the same reference.
 */
export class DefaultMap<K, V> extends Map<K, V> {
  /** Saves the default value callback */
  public constructor(private defaultVal: () => V) {
    super();
  }
  /** Gets the value for the given key or the default value
   * if none was yet added. Adds the default value to the map.
   * In comparison to get() it also returns the actual type, not undefined.
   * @param key the search key to lookup the value.
   * @returns the value - either the saved or newly created default.
   */
  public getDef(key: K): V {
    const v = super.get(key);
    return v === undefined ? this._createDefault(key) : v;
  }

  private _createDefault(key: K) {
    const newValue = this.defaultVal();
    super.set(key, newValue);
    return newValue;
  }
}
