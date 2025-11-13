/**
 * Progressive PLY Loader for Gaussian Splats
 *
 * Loads binary chunks in staggered parallel batches from Google Cloud Storage,
 * provides real-time progress tracking, and concatenates into a single PLY file.
 */

import { ecoLoadingMessages } from '../ui/loading/ecoLoadingMessages.js';

class ProgressivePlyLoader {
    constructor() {
        this.manifest = null;
        this.downloadedParts = new Map();
        this.downloadProgress = new Map();
        this.onProgressCallback = null;
        this.onCompleteCallback = null;
        this.onErrorCallback = null;
        this.abortControllers = [];
        this.concurrentDownloads = 5;
        this.messageInterval = null;
        this.currentMessageIndex = 0;
    }

    /**
     * Set progress callback - called with (loadedBytes, totalBytes, partsLoaded, totalParts)
     */
    setProgressCallback(callback) {
        this.onProgressCallback = callback;
    }

    /**
     * Set completion callback - called with merged PLY Blob
     */
    setCompleteCallback(callback) {
        this.onCompleteCallback = callback;
    }

    /**
     * Set error callback
     */
    setErrorCallback(callback) {
        this.onErrorCallback = callback;
    }

    /**
     * Load binary chunks progressively and concatenate into single PLY file
     * @param {string} siteId - Site identifier
     * @returns {Promise<File>} - Single PLY File object
     */
    async loadPlyFiles(siteId) {
        try {
            console.log(`📥 Progressive Binary Chunk Loader: Starting load for site ${siteId}`);

            this.manifest = await this.fetchManifest(siteId);

            if (!this.manifest || !this.manifest.parts || this.manifest.parts.length === 0) {
                throw new Error('Invalid or empty manifest');
            }

            const totalParts = this.manifest.parts.length;
            console.log(`📦 Downloading ${totalParts} binary chunks (${this.concurrentDownloads} at a time)...`);

            this.startLoadingMessages();

            const chunks = await this.downloadChunksStaggered(totalParts);

            this.stopLoadingMessages();

            console.log(`🔧 Concatenating ${chunks.length} chunks into single PLY file...`);
            const concatenatedBlob = new Blob(chunks, { type: 'application/octet-stream' });
            const plyFile = new File([concatenatedBlob], 'splat.ply', { type: 'application/octet-stream' });

            console.log(`✅ Assembled PLY file: ${(plyFile.size / 1024 / 1024).toFixed(2)} MB`);

            if (this.onCompleteCallback) {
                this.onCompleteCallback(plyFile);
            }

            return plyFile;

        } catch (error) {
            this.stopLoadingMessages();
            console.error('❌ Progressive loading failed:', error);
            if (this.onErrorCallback) {
                this.onErrorCallback(error);
            }
            throw error;
        }
    }

    startLoadingMessages() {
        this.currentMessageIndex = Math.floor(Math.random() * ecoLoadingMessages.length);
        this.updateLoadingMessage();

        this.messageInterval = setInterval(() => {
            this.updateLoadingMessage();
        }, 3000);
    }

    stopLoadingMessages() {
        if (this.messageInterval) {
            clearInterval(this.messageInterval);
            this.messageInterval = null;
        }
    }

    updateLoadingMessage() {
        const message = ecoLoadingMessages[this.currentMessageIndex];
        this.currentMessageIndex = (this.currentMessageIndex + 1) % ecoLoadingMessages.length;

        const loadingMessage = document.getElementById('loadingMessage');
        if (loadingMessage) {
            loadingMessage.textContent = message;
        }
    }

    async downloadChunksStaggered(totalParts) {
        const chunks = new Array(totalParts);
        let currentIndex = 0;
        const activeDownloads = new Set();

        const downloadNext = async () => {
            if (currentIndex >= totalParts) {
                return;
            }

            const index = currentIndex++;
            const part = this.manifest.parts[index];

            const downloadPromise = this.downloadChunk(part, index, totalParts)
                .then(chunk => {
                    chunks[index] = chunk;
                    activeDownloads.delete(downloadPromise);
                    return downloadNext();
                })
                .catch(error => {
                    activeDownloads.delete(downloadPromise);
                    throw error;
                });

            activeDownloads.add(downloadPromise);
            return downloadPromise;
        };

        const initialBatch = [];
        for (let i = 0; i < this.concurrentDownloads; i++) {
            initialBatch.push(downloadNext());
        }

        await Promise.all(initialBatch);

        return chunks;
    }

    /**
     * Fetch manifest from server
     */
    async fetchManifest(siteId) {
        const manifestUrl = `/api/splat-manifest/${siteId}`;
        console.log(`📄 Fetching manifest from ${manifestUrl}`);

        const response = await fetch(manifestUrl);
        if (!response.ok) {
            throw new Error(`Manifest fetch failed: ${response.statusText}`);
        }

        const manifest = await response.json();
        console.log(`📋 Manifest loaded:`, manifest);

        return manifest;
    }

    /**
     * Download a single binary chunk
     */
    async downloadChunk(partInfo, index, totalParts) {
        const url = partInfo.url;
        const abortController = new AbortController();
        this.abortControllers.push(abortController);

        try {
            const response = await fetch(url, {
                signal: abortController.signal,
                cache: 'no-store'
            });

            if (!response.ok) {
                throw new Error(`Chunk ${index} download failed: ${response.statusText}`);
            }

            const contentLength = parseInt(response.headers.get('content-length') || '0', 10);

            this.downloadProgress.set(index, {
                loaded: 0,
                total: contentLength
            });

            const reader = response.body.getReader();
            const chunks = [];
            let receivedLength = 0;

            while (true) {
                const { done, value } = await reader.read();

                if (done) break;

                chunks.push(value);
                receivedLength += value.length;

                this.downloadProgress.set(index, {
                    loaded: receivedLength,
                    total: contentLength
                });

                this.updateProgress(totalParts);
            }

            const allChunks = new Uint8Array(receivedLength);
            let position = 0;
            for (const chunk of chunks) {
                allChunks.set(chunk, position);
                position += chunk.length;
            }

            this.downloadedParts.set(index, allChunks);
            return allChunks;

        } catch (error) {
            if (error.name === 'AbortError') {
                console.log(`⚠️ Chunk ${index} download aborted`);
                throw new Error('Download aborted');
            }
            console.error(`❌ Chunk ${index} download failed:`, error);
            throw error;
        }
    }

    /**
     * Download a single PLY part as a File object with proper filename (LEGACY)
     */
    async downloadPartAsFile(partInfo, index, totalParts) {
        const url = partInfo.url;
        const filename = partInfo.filename;
        const abortController = new AbortController();
        this.abortControllers.push(abortController);

        try {
            const response = await fetch(url, {
                signal: abortController.signal,
                cache: 'no-store'
            });

            if (!response.ok) {
                throw new Error(`Part ${index} download failed: ${response.statusText}`);
            }

            const contentLength = parseInt(response.headers.get('content-length') || '0', 10);

            this.downloadProgress.set(index, {
                loaded: 0,
                total: contentLength
            });

            const reader = response.body.getReader();
            const chunks = [];
            let receivedLength = 0;

            while (true) {
                const { done, value } = await reader.read();

                if (done) break;

                chunks.push(value);
                receivedLength += value.length;

                this.downloadProgress.set(index, {
                    loaded: receivedLength,
                    total: contentLength
                });

                this.updateProgress(totalParts);
            }

            const allChunks = new Uint8Array(receivedLength);
            let position = 0;
            for (const chunk of chunks) {
                allChunks.set(chunk, position);
                position += chunk.length;
            }

            console.log(`✅ Part ${index + 1}/${totalParts} downloaded: ${filename} (${(receivedLength / 1024 / 1024).toFixed(2)} MB)`);

            const file = new File([allChunks], filename, { type: 'application/octet-stream' });
            this.downloadedParts.set(index, file);
            return file;

        } catch (error) {
            if (error.name === 'AbortError') {
                console.log(`⚠️ Part ${index} download aborted`);
                throw new Error('Download aborted');
            }
            console.error(`❌ Part ${index} download failed:`, error);
            throw error;
        }
    }

    /**
     * Download a single PLY part with progress tracking (legacy method)
     */
    async downloadPart(partInfo, index, totalParts) {
        // Add cache-busting parameter to bypass CDN cache that was cached before CORS was configured
        const url = `${partInfo.url}?t=${Date.now()}`;
        const abortController = new AbortController();
        this.abortControllers.push(abortController);

        try {
            const response = await fetch(url, {
                signal: abortController.signal,
                cache: 'no-store'
            });

            if (!response.ok) {
                throw new Error(`Part ${index} download failed: ${response.statusText}`);
            }

            const contentLength = parseInt(response.headers.get('content-length') || '0', 10);

            // Track progress for this part
            this.downloadProgress.set(index, {
                loaded: 0,
                total: contentLength
            });

            // Read response with progress tracking
            const reader = response.body.getReader();
            const chunks = [];
            let receivedLength = 0;

            while (true) {
                const { done, value } = await reader.read();

                if (done) break;

                chunks.push(value);
                receivedLength += value.length;

                // Update progress for this part
                this.downloadProgress.set(index, {
                    loaded: receivedLength,
                    total: contentLength
                });

                // Call progress callback
                this.updateProgress(totalParts);
            }

            // Combine chunks into single array
            const allChunks = new Uint8Array(receivedLength);
            let position = 0;
            for (const chunk of chunks) {
                allChunks.set(chunk, position);
                position += chunk.length;
            }

            console.log(`✅ Part ${index + 1}/${totalParts} downloaded: ${(receivedLength / 1024 / 1024).toFixed(2)} MB`);

            this.downloadedParts.set(index, allChunks);
            return allChunks;

        } catch (error) {
            if (error.name === 'AbortError') {
                console.log(`⚠️ Part ${index} download aborted`);
                throw new Error('Download aborted');
            }
            console.error(`❌ Part ${index} download failed:`, error);
            throw error;
        }
    }

    /**
     * Update overall progress and call callback
     */
    updateProgress(totalParts) {
        let totalLoaded = 0;
        let totalSize = 0;
        let partsCompleted = 0;

        for (const [index, progress] of this.downloadProgress.entries()) {
            totalLoaded += progress.loaded;
            totalSize += progress.total;
            if (progress.loaded === progress.total && progress.total > 0) {
                partsCompleted++;
            }
        }

        if (this.onProgressCallback) {
            this.onProgressCallback(totalLoaded, totalSize, partsCompleted, totalParts);
        }
    }

    /**
     * Merge multiple PLY parts into a single PLY file
     * Handles SuperSplat's compressed format with chunks, vertices, and SH data
     */
    async mergePlyParts(parts) {
        if (parts.length === 0) {
            throw new Error('No parts to merge');
        }

        if (parts.length === 1) {
            // Only one part, return as-is
            return new Blob([parts[0]], { type: 'application/octet-stream' });
        }

        console.log(`🔧 Merging ${parts.length} PLY parts...`);

        // Parse first part to get header structure and chunk data
        const firstPart = parts[0];
        const { header, chunkData, headerEndOffset } = this.parsePlyHeader(firstPart);

        // Calculate total vertices across all parts
        let totalVertices = 0;
        const partVertexCounts = [];

        for (const part of parts) {
            const { header: partHeader } = this.parsePlyHeader(part);
            const vertexElem = partHeader.elements.find(e => e.name === 'vertex');
            if (vertexElem) {
                partVertexCounts.push(vertexElem.count);
                totalVertices += vertexElem.count;
            }
        }

        console.log(`   Total vertices: ${totalVertices.toLocaleString()}`);
        console.log(`   Part vertex counts: ${partVertexCounts.join(', ')}`);

        // Create new header with updated vertex count
        const mergedHeader = this.createMergedHeader(header, totalVertices);
        const mergedHeaderBytes = new TextEncoder().encode(mergedHeader);

        // Collect all vertex and SH data from parts
        const allVertexData = [];
        const allShData = [];

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const { header: partHeader, headerEndOffset: partOffset } = this.parsePlyHeader(part);

            // Find element sizes
            const vertexElem = partHeader.elements.find(e => e.name === 'vertex');
            const shElem = partHeader.elements.find(e => e.name === 'sh');
            const chunkElem = partHeader.elements.find(e => e.name === 'chunk');

            const chunkSize = chunkElem ? this.calculateElementSize(chunkElem.properties) * chunkElem.count : 0;
            const vertexSize = vertexElem ? this.calculateElementSize(vertexElem.properties) : 0;
            const shSize = shElem ? this.calculateElementSize(shElem.properties) : 0;

            // Skip chunk data, extract vertex and SH data
            let dataOffset = partOffset + chunkSize;

            // Extract vertex data
            const vertexDataSize = vertexSize * vertexElem.count;
            const vertexData = part.slice(dataOffset, dataOffset + vertexDataSize);
            allVertexData.push(vertexData);
            dataOffset += vertexDataSize;

            // Extract SH data
            if (shElem && shSize > 0) {
                const shDataSize = shSize * shElem.count;
                const shData = part.slice(dataOffset, dataOffset + shDataSize);
                allShData.push(shData);
            }

            console.log(`   Part ${i + 1}: ${vertexElem.count.toLocaleString()} vertices, ${vertexDataSize.toLocaleString()} bytes`);
        }

        // Concatenate all data
        const totalSize = mergedHeaderBytes.length + chunkData.length +
                         allVertexData.reduce((sum, d) => sum + d.length, 0) +
                         allShData.reduce((sum, d) => sum + d.length, 0);

        const mergedData = new Uint8Array(totalSize);
        let offset = 0;

        // Write header
        mergedData.set(mergedHeaderBytes, offset);
        offset += mergedHeaderBytes.length;

        // Write chunk data (same for all parts)
        mergedData.set(chunkData, offset);
        offset += chunkData.length;

        // Write all vertex data
        for (const vertexData of allVertexData) {
            mergedData.set(new Uint8Array(vertexData.buffer || vertexData), offset);
            offset += vertexData.length;
        }

        // Write all SH data
        for (const shData of allShData) {
            mergedData.set(new Uint8Array(shData.buffer || shData), offset);
            offset += shData.length;
        }

        console.log(`✅ Merged PLY: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

        return new Blob([mergedData], { type: 'application/octet-stream' });
    }

    /**
     * Parse PLY header and return header info + data offset
     */
    parsePlyHeader(data) {
        const decoder = new TextDecoder('ascii');
        let offset = 0;
        const lines = [];

        // Read header line by line
        while (offset < data.length) {
            // Find newline
            let lineEnd = offset;
            while (lineEnd < data.length && data[lineEnd] !== 10) { // 10 = '\n'
                lineEnd++;
            }

            const line = decoder.decode(data.slice(offset, lineEnd)).trim();
            lines.push(line);

            if (line === 'end_header') {
                offset = lineEnd + 1; // Move past newline
                break;
            }

            offset = lineEnd + 1;
        }

        // Parse header structure
        const header = {
            format: '',
            comments: [],
            elements: []
        };

        let currentElement = null;

        for (const line of lines) {
            const parts = line.split(/\s+/);
            const keyword = parts[0];

            if (keyword === 'ply') continue;
            if (keyword === 'end_header') break;

            if (keyword === 'format') {
                header.format = parts.slice(1).join(' ');
            } else if (keyword === 'comment') {
                header.comments.push(parts.slice(1).join(' '));
            } else if (keyword === 'element') {
                currentElement = {
                    name: parts[1],
                    count: parseInt(parts[2]),
                    properties: []
                };
                header.elements.push(currentElement);
            } else if (keyword === 'property' && currentElement) {
                currentElement.properties.push({
                    type: parts[1],
                    name: parts.slice(2).join(' ')
                });
            }
        }

        // Extract chunk data (after header, before vertex data)
        const chunkElem = header.elements.find(e => e.name === 'chunk');
        const chunkSize = chunkElem ? this.calculateElementSize(chunkElem.properties) * chunkElem.count : 0;
        const chunkData = data.slice(offset, offset + chunkSize);

        return {
            header,
            chunkData,
            headerEndOffset: offset
        };
    }

    /**
     * Calculate byte size of element from properties
     */
    calculateElementSize(properties) {
        const typeSizes = {
            'char': 1, 'uchar': 1,
            'short': 2, 'ushort': 2,
            'int': 4, 'uint': 4,
            'float': 4, 'double': 8
        };

        return properties.reduce((sum, prop) => sum + (typeSizes[prop.type] || 0), 0);
    }

    /**
     * Create merged header with updated vertex count
     */
    createMergedHeader(header, totalVertices) {
        const lines = ['ply', `format ${header.format}`];

        // Add comments
        for (const comment of header.comments) {
            lines.push(`comment ${comment}`);
        }

        // Add elements with updated vertex count
        for (const elem of header.elements) {
            const count = (elem.name === 'vertex' || elem.name === 'sh') ? totalVertices : elem.count;
            lines.push(`element ${elem.name} ${count}`);

            for (const prop of elem.properties) {
                lines.push(`property ${prop.type} ${prop.name}`);
            }
        }

        lines.push('end_header');
        return lines.join('\n') + '\n';
    }

    /**
     * Cancel all ongoing downloads
     */
    cancel() {
        console.log('🛑 Cancelling all downloads');
        for (const controller of this.abortControllers) {
            controller.abort();
        }
        this.abortControllers = [];
        this.downloadedParts.clear();
        this.downloadProgress.clear();
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.ProgressivePlyLoader = ProgressivePlyLoader;
}
