/**
 * Binary data writer utility for CHD format
 * Provides efficient writing of binary data with proper endianness handling
 */
export class BinaryWriter {
  constructor(littleEndian = true) {
    this.buffers = [];
    this.littleEndian = littleEndian;
    this.size = 0;
  }

  /**
   * Get current write position (total bytes written)
   */
  getSize() {
    return this.size;
  }

  /**
   * Write magic number as string
   */
  writeMagic(magic) {
    const bytes = new Uint8Array(magic.length);
    for (let i = 0; i < magic.length; i++) {
      bytes[i] = magic.charCodeAt(i);
    }
    this.writeBytes(bytes);
  }

  /**
   * Write raw bytes
   */
  writeBytes(bytes) {
    const buffer = new Uint8Array(bytes);
    this.buffers.push(buffer);
    this.size += buffer.length;
  }

  /**
   * Write unsigned 8-bit integer
   */
  writeUInt8(value) {
    const buffer = new ArrayBuffer(1);
    const view = new DataView(buffer);
    view.setUint8(0, value);
    this.writeBytes(new Uint8Array(buffer));
  }

  /**
   * Write unsigned 16-bit integer
   */
  writeUInt16(value) {
    const buffer = new ArrayBuffer(2);
    const view = new DataView(buffer);
    view.setUint16(0, value, this.littleEndian);
    this.writeBytes(new Uint8Array(buffer));
  }

  /**
   * Write unsigned 32-bit integer
   */
  writeUInt32(value) {
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setUint32(0, value, this.littleEndian);
    this.writeBytes(new Uint8Array(buffer));
  }

  /**
   * Write signed 32-bit integer
   */
  writeInt32(value) {
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setInt32(0, value, this.littleEndian);
    this.writeBytes(new Uint8Array(buffer));
  }

  /**
   * Write 32-bit float
   */
  writeFloat32(value) {
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setFloat32(0, value, this.littleEndian);
    this.writeBytes(new Uint8Array(buffer));
  }

  /**
   * Write 64-bit float
   */
  writeFloat64(value) {
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    view.setFloat64(0, value, this.littleEndian);
    this.writeBytes(new Uint8Array(buffer));
  }

  /**
   * Write array of 32-bit floats
   */
  writeFloat32Array(array) {
    for (const value of array) {
      this.writeFloat32(value);
    }
  }

  /**
   * Write array of 32-bit unsigned integers
   */
  writeUInt32Array(array) {
    for (const value of array) {
      this.writeUInt32(value);
    }
  }

  /**
   * Write array of 16-bit unsigned integers
   */
  writeUInt16Array(array) {
    for (const value of array) {
      this.writeUInt16(value);
    }
  }

  /**
   * Write bounding box (6 floats: minX, minY, minZ, maxX, maxY, maxZ)
   */
  writeBoundingBox(boundingBox) {
    this.writeFloat32(boundingBox.min[0]);
    this.writeFloat32(boundingBox.min[1]);
    this.writeFloat32(boundingBox.min[2]);
    this.writeFloat32(boundingBox.max[0]);
    this.writeFloat32(boundingBox.max[1]);
    this.writeFloat32(boundingBox.max[2]);
  }

  /**
   * Write null-terminated string
   */
  writeString(str) {
    const bytes = new TextEncoder().encode(str);
    this.writeBytes(bytes);
    this.writeUInt8(0); // null terminator
  }

  /**
   * Write length-prefixed string
   */
  writeLengthString(str) {
    const bytes = new TextEncoder().encode(str);
    this.writeUInt32(bytes.length);
    this.writeBytes(bytes);
  }

  /**
   * Write padding bytes
   */
  writePadding(count, value = 0) {
    const padding = new Uint8Array(count).fill(value);
    this.writeBytes(padding);
  }

  /**
   * Align to specific byte boundary
   */
  alignTo(boundary) {
    const remainder = this.size % boundary;
    if (remainder !== 0) {
      this.writePadding(boundary - remainder);
    }
  }

  /**
   * Get the final buffer
   */
  getBuffer() {
    if (this.buffers.length === 0) {
      return new ArrayBuffer(0);
    }
    
    if (this.buffers.length === 1) {
      return this.buffers[0].buffer;
    }
    
    // Concatenate all buffers
    const result = new Uint8Array(this.size);
    let offset = 0;
    
    for (const buffer of this.buffers) {
      result.set(buffer, offset);
      offset += buffer.length;
    }
    
    return result.buffer;
  }

  /**
   * Get the final buffer as Uint8Array
   */
  getUint8Array() {
    return new Uint8Array(this.getBuffer());
  }

  /**
   * Reset writer state
   */
  reset() {
    this.buffers = [];
    this.size = 0;
  }

  /**
   * Create a new writer and write callback to it
   */
  static create(callback, littleEndian = true) {
    const writer = new BinaryWriter(littleEndian);
    callback(writer);
    return writer.getBuffer();
  }

  /**
   * Calculate CRC32 checksum of current data
   */
  calculateCRC32() {
    const buffer = this.getUint8Array();
    return this.crc32(buffer);
  }

  /**
   * CRC32 calculation
   */
  crc32(data) {
    const table = this.generateCRC32Table();
    let crc = 0xFFFFFFFF;
    
    for (let i = 0; i < data.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xFF];
    }
    
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  /**
   * Generate CRC32 lookup table
   */
  generateCRC32Table() {
    if (BinaryWriter._crc32Table) {
      return BinaryWriter._crc32Table;
    }
    
    const table = new Uint32Array(256);
    
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c;
    }
    
    BinaryWriter._crc32Table = table;
    return table;
  }
}