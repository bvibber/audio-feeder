/**
 * Abstraction around a queue of audio buffers.
 *
 * Stuff input buffers of any length in via append(buffer),
 * check how much is queued with sampleCount(), and pull out
 * data from the buffer head with shift(maxSampleCount).
 *
 * Buffers are arrays containing one Float32Array of sample data
 * per channel. Channel counts must match the expected value, and
 * all channels within a buffer must have the same length in samples.
 *
 * Since input data may be stored for a while before being taken
 * back out, be sure that your Float32Arrays for channel data are
 * standalone, not backed on an ArrayBuffer that might change!
 *
 * @copyright (c) 2013-2016 Brion Vibber <brion@pobox.com>
 * @license MIT
 */
function BufferQueue(numChannels) {
  if (numChannels < 1 || numChannels !== Math.round(numChannels)) {
    throw 'Invalid channel count for BufferQueue';
  }
  this.channels = numChannels;
  this._buffers = [];
}

/**
 * Count how many samples are queued up
 *
 * @return {number}
 */
BufferQueue.prototype.sampleCount = function() {
  var count = 0;
  this._buffers.forEach(function(buffer) {
    count += buffer[0].length;
  });
  return count;
};

/**
 * Validate a buffer for correct object layout
 *
 * @param buffer {Array}
 * @throws on invalid input
 */
BufferQueue.prototype.validate = function(buffer) {
  if (buffer.length !== this.channels) {
    throw 'Mismatch in channel count between buffer and queue';
  }

  var sampleCount;
  for (var i = 0; i < buffer.length; i++) {
    var channelData = buffer[i];
    if (!(channelData instanceof Float32Array)) {
      throw 'Channel data not in Float32Array format';
    }
    if (i == 0) {
      sampleCount = channelData.length;
    } else if (channelData.length !== sampleCount) {
      throw 'Channel data not of matching length';
    }
  }
};

/**
 * Append a buffer of input data to the queue...
 *
 * @param {Array} of Float32Arrays
 */
BufferQueue.prototype.append = function(buffer) {
  this.validate(buffer);
  this._buffers.push(buffer);
};

/**
 * Shift out a buffer with up to the given maximum sample count
 *
 * @param {number} maxSamples
 */
BufferQueue.prototype.shift = function(maxSamples) {
  var sampleCount = Math.min(this.sampleCount(), maxSamples | 0),
    output = this.createBuffer(sampleCount),
    input = null,
    inputSamples = 0,
    pos = 0,
    split = false,
    splitPoint = 0,
    splitBuffer = null,
    a = null,
    b = null,
    inputData = null,
    i = 0;

  while (output.length < sampleCount) {
    input = this._buffers[0];
    inputSamples = input[0].length;

    // Will this input buffer overflow our maximum?
    if (pos + inputSamples > sampleCount) {
      // Yep, split it in twain and store the rest for next time.
      splitPoint = sampleCount - pos;
      a = [];
      b = [];
      for (i = 0; i < this.channels; i++) {
        a.push(input[i].subarray(0, splitPoint));
        b.push(input[i].subarray(splitPoint));
      }
      input = a;
      this._buffers[0] = b;
    } else {
      // Nope, shift it off the queue.
      this._buffers.shift()
    }

    // Copy to output...
    for (var i = 0; i < this.channels; i++) {
      inputData = input[i];
      output[i].set(inputData, pos);
    }
    pos += inputSamples;
  }

  return output;
};

module.exports = BufferQueue;
