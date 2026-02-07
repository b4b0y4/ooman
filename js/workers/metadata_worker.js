self.onmessage = async (e) => {
  const { files, batchSize = 200 } = e.data;

  let buffer = [];

  for (const file of files) {
    try {
      const url = new URL(file, self.location.origin + "/").href;
      const res = await fetch(url);

      if (!res.ok) throw new Error(`HTTP ${res.status}: ${file}`);

      const data = await res.json();

      buffer.push(...data);

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
