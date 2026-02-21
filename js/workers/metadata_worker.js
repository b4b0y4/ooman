self.onmessage = async (e) => {
  const { files, batchSize = 200 } = e.data;

  let buffer = [];

  for (const file of files) {
    try {
      const url = new URL(file, self.location.origin + "/").href;
      const res = await fetch(url);

      if (!res.ok) throw new Error(`HTTP ${res.status}: ${file}`);

      const rawText = await res.text();
      const data = JSON.parse(rawText);

      const proofs = Array.isArray(data)
        ? data.map((item) => {
            const namePattern = '"name": "' + item.name + '"';
            const itemStart = rawText.indexOf(namePattern);

            const nextMatch = rawText
              .substring(itemStart + namePattern.length)
              .match(/"name": "Ooman #\d+"/);
            const itemEnd = nextMatch
              ? itemStart + namePattern.length + nextMatch.index
              : rawText.length;
            const itemSection = rawText.substring(itemStart, itemEnd);

            const attrsMatch = itemSection.match(
              /"attributes":\s*"((?:\\.|[^"\\])*)"/,
            );

            let attributesString;
            if (attrsMatch) {
              attributesString = attrsMatch[1].replace(/\\(.)/g, "$1");
            } else {
              attributesString = item.attributes;
            }

            const attributesParsed = JSON.parse(attributesString);

            return {
              ...item,
              proof: item.merkle_proof || item.proof,
              attributes: attributesString,
              attributesParsed: attributesParsed,
            };
          })
        : Object.values(data.proofs || {}).map((item) => {
            const attributesParsed =
              typeof item.attributes === "string"
                ? JSON.parse(item.attributes)
                : item.attributes;
            const attributesString =
              typeof item.attributes === "string"
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
