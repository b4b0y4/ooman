self.onmessage = async (e) => {
  const { files, batchSize = 100 } = e.data;

  let buffer = [];

  for (const file of files) {
    try {
      const res = await fetch(file);
      if (!res.ok) throw new Error(file);

      const text = await res.text();
      const data = JSON.parse(text);

      for (const item of data) {
        buffer.push(item);

        if (buffer.length >= batchSize) {
          self.postMessage({
            type: "batch",
            data: buffer,
          });
          buffer = [];
        }
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
