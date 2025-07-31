/**
 * Binary data reader utility for CHD format
 * Provides efficient reading of binary data with proper endianness handling
 */
export class BinaryReader {
  constructor(buffer, littleEndian = true) {
    this.buffer = buffer;
    this.view = new DataView(buffer);
    this.offset = 0;
    this.littleEndian = littleEndian;
  }

  /**
   * Get current read position
   */
  getOffset() {
    return this.offset;
  }

  /**
   * Set read position
   */
  setOffset(offset) {
    if (offset < 0 || offset > this.buffer.byteLength) {
      throw new Error(`Invalid offset: ${offset}`);
    }
    this.offset = offset;
  }

  /**
   * Check if we can read the specified number of bytes
   */
  canRead(bytes) {
    return this.offset + bytes <= this.buffer.byteLength;
  }

  /**
   * Skip bytes
   */
  skip(bytes) {
    this.offset += bytes;
  }

  /**
   * Read magic number as string
   */
  readMagic(length = 4) {
    const bytes = this.readBytes(length);
    return String.fromCharCode(...bytes);
  }

  /**
   * Read raw bytes
   */
  readBytes(length) {
    if (!this.canRead(length)) {
      throw new Error(`Cannot read ${length} bytes at offset ${this.offset}`);
    }
    
    const bytes = new Uint8Array(this.buffer, this.offset, length);
    this.offset += length;
    return bytes;
  }

  /**
   * Read unsigned 8-bit integer
   */
  readUInt8() {
    if (!this.canRead(1)) {
      throw new Error(`Cannot read UInt8 at offset ${this.offset}`);
    }
    
    const value = this.view.getUint8(this.offset);
    this.offset += 1;
    return value;
  }

  /**
   * Read unsigned 16-bit integer
   */
  readUInt16() {
    if (!this.canRead(2)) {
      throw new Error(`Cannot read UInt16 at offset ${this.offset}`);
    }
    
    const value = this.view.getUint16(this.offset, this.littleEndian);
    this.offset += 2;
    return value;
  }

  /**
   * Read unsigned 32-bit integer
   */
  readUInt32() {
    if (!this.canRead(4)) {
      throw new Error(`Cannot read UInt32 at offset ${this.offset}`);
    }
    
    const value = this.view.getUint32(this.offset, this.littleEndian);
    this.offset += 4;
    return value;
  }

  /**
   * Read signed 32-bit integer
   */
  readInt32() {
    if (!this.canRead(4)) {
      throw new Error(`Cannot read Int32 at offset ${this.offset}`);
    }
    
    const value = this.view.getInt32(this.offset, this.littleEndian);
    this.offset += 4;
    return value;
  }

  /**
   * Read 32-bit float
   */
  readFloat32() {
    if (!this.canRead(4)) {
      throw new Error(`Cannot read Float32 at offset ${this.offset}`);
    }
    
    const value = this.view.getFloat32(this.offset, this.littleEndian);
    this.offset += 4;
    return value;
  }

  /**
   * Read 64-bit float
   */
  readFloat64() {
    if (!this.canRead(8)) {
      throw new Error(`Cannot read Float64 at offset ${this.offset}`);
    }
    
    const value = this.view.getFloat64(this.offset, this.littleEndian);
    this.offset += 8;
    return value;
  }

  /**
   * Read array of 32-bit floats
   */
  readFloat32Array(count) {
    const array = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      array[i] = this.readFloat32();
    }
    return array;
  }

  /**
   * Read array of 32-bit unsigned integers
   */
  readUInt32Array(count) {
    const array = new Uint32Array(count);
    for (let i = 0; i < count; i++) {
      array[i] = this.readUInt32();
    }
    return array;
  }

  /**
   * Read array of 16-bit unsigned integers
   */
  readUInt16Array(count) {
    const array = new Uint16Array(count);
    for (let i = 0; i < count; i++) {
      array[i] = this.readUInt16();
    }
    return array;
  }

  /**
   * Read bounding box (6 floats: minX, minY, minZ, maxX, maxY, maxZ)
   */
  readBoundingBox() {
    return {
      min: [this.readFloat32(), this.readFloat32(), this.readFloat32()],
      max: [this.readFloat32(), this.readFloat32(), this.readFloat32()]
    };
  }

  /**
   * Read null-terminated string
   */
  readString(maxLength = 256) {
    const bytes = [];
    let byte;
    let count = 0;
    
    while (count < maxLength && this.canRead(1)) {
      byte = this.readUInt8();
      if (byte === 0) break;
      bytes.push(byte);
      count++;
    }
    
    return String.fromCharCode(...bytes);
  }

  /**
   * Read length-prefixed string
   */
  readLengthString() {
    const length = this.readUInt32();
    const bytes = this.readBytes(length);
    return new TextDecoder().decode(bytes);
  }

  /**
   * Peek at next bytes without advancing position
   */
  peek(length) {
    const currentOffset = this.offset;
    const bytes = this.readBytes(length);
    this.offset = currentOffset;
    return bytes;
  }

  /**
   * Check if magic number matches expected value
   */
  validateMagic(expected) {
    const magic = this.readMagic(expected.length);
    if (magic !== expected) {
      throw new Error(`Invalid magic number. Expected '${expected}', got '${magic}'`);
    }
    return true;
  }

  /**
   * Get remaining bytes count
   */
  getRemainingBytes() {
    return this.buffer.byteLength - this.offset;
  }

  /**
   * Create a slice of the buffer from current position
   */
  slice(length) {
    if (!this.canRead(length)) {
      throw new Error(`Cannot slice ${length} bytes at offset ${this.offset}`);
    }
    
    const slice = this.buffer.slice(this.offset, this.offset + length);
    this.offset += length;
    return slice;
  }

  /**
   * Reset to beginning
   */
  reset() {
    this.offset = 0;
  }

  /**
   * Create a new BinaryReader from a slice
   */
  createSliceReader(length) {
    const slice = this.slice(length);
    return new BinaryReader(slice, this.littleEndian);
  }
}