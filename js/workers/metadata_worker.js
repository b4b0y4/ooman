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
            // Find the position of this item's "name" field to locate the item boundary
            const namePattern = '"name": "' + item.name + '"';
            const itemStart = rawText.indexOf(namePattern);

            // Find the next item by looking for the next "name": "Ooman #..."
            // or end of array
            const nextMatch = rawText.substring(itemStart + namePattern.length).match(/"name": "Ooman #\d+"/);
            const itemEnd = nextMatch ? itemStart + namePattern.length + nextMatch.index : rawText.length;
            const itemSection = rawText.substring(itemStart, itemEnd);

            const attrsMatch = itemSection.match(/"attributes":\s*"((?:\\.|[^"\\])*)"/);

            // Extract the exact string as stored in the JSON (unescape it)
            let attributesString;
            if (attrsMatch) {
              // attrsMatch[1] contains the escaped content like [{\trait_type\":...}]
              // We need to unescape it to get the raw string
              attributesString = attrsMatch[1].replace(/\\(.)/g, '$1');
            } else {
              attributesString = item.attributes;
            }

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
