self.onmessage = async (e) => {
  const { files, batchSize = 200 } = e.data;

  let buffer = [];

  for (const file of files) {
    try {
      const url = new URL(file, self.location.origin + "/").href;
      const res = await fetch(url);

      if (!res.ok) throw new Error(`HTTP ${res.status}: ${file}`);

      // Fetch raw text to preserve exact JSON formatting
      const rawText = await res.text();
      const data = JSON.parse(rawText);

      // Handle new metadata format: array of objects with merkle_proof field
      const proofs = Array.isArray(data) 
        ? data.map((item) => {
            // Extract the exact attributes string from raw JSON
            const itemStart = rawText.indexOf('"token_id": ' + item.token_id);
            const itemEnd = rawText.indexOf('"token_id": ' + (item.token_id + 1));
            const itemSection = itemEnd > 0 
              ? rawText.substring(itemStart, itemEnd) 
              : rawText.substring(itemStart);
            
            const attrsMatch = itemSection.match(/"attributes":\s*"((?:\\.|[^"\\])*)"/);
            // Use exact string from file, fallback to the parsed value
            const attributesString = attrsMatch 
              ? JSON.parse('"' + attrsMatch[1] + '"')
              : item.attributes;
            // Parse the string to get the array for UI
            const attributesParsed = JSON.parse(attributesString);
            
            return {
              ...item,
              proof: item.merkle_proof || item.proof,
              attributes: attributesString,  // Exact string for contract
              attributesParsed: attributesParsed,  // Array for UI
            };
          })
        : Object.values(data.proofs || {}).map((item) => {
            const attributesParsed = typeof item.attributes === "string"
              ? JSON.parse(item.attributes)
              : item.attributes;
            const attributesString = typeof item.attributes === "string"
              ? item.attributes
              : JSON.stringify(attributesParsed);
            return {
              ...item,
              attributes: attributesString,
              attributesParsed: attributesParsed,
            };
          });
      buffer.push(...proofs);

      if (buffer.length >= batchSize) {
        self.postMessage({
          type: "batch",
          data: buffer,
        });
        buffer = [];
      }
    } catch (err) {
      self.postMessage({
        type: "error",
        file,
        error: err.message,
      });
    }
  }

  if (buffer.length) {
    self.postMessage({ type: "batch", data: buffer });
  }

  self.postMessage({ type: "done" });
};
