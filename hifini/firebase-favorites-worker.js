function parseJsonResponses(text) {
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    const responses = [];
    let start = -1;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = 0; index < text.length; index++) {
      const character = text[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') inString = false;
        continue;
      }
      if (character === '"') inString = true;
      else if (character === "{") {
        if (depth === 0) start = index;
        depth++;
      } else if (character === "}" && --depth === 0 && start !== -1) {
        responses.push(JSON.parse(text.slice(start, index + 1)));
        start = -1;
      }
    }
    if (!responses.length || depth !== 0)
      throw new Error("Invalid Firebase favorites response.");
    return responses;
  }
}

async function requestJson(url, idToken, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(
      `Firebase favorites request failed (${response.status}): ${responseText}`
    );
  }
  return responseText;
}

async function syncFavorites({ projectId, userId, idToken, localRecords }) {
  if (!Array.isArray(localRecords) || localRecords.length > 10) {
    throw new Error("A favorites sync must contain no more than 10 songs.");
  }
  const records = localRecords.filter(
    (record) =>
      record &&
      typeof record.key === "string" &&
      record.key.length > 0 &&
      typeof record.fav === "boolean" &&
      Number.isFinite(Number(record.updatedAt))
  );
  if (records.length !== localRecords.length)
    throw new Error("Invalid favorite record in sync request.");
  if (!records.length)
    return { downloadedCount: 0, uploadedCount: 0, remoteUpdates: [] };

  const database = `projects/${encodeURIComponent(
    projectId
  )}/databases/(default)/documents`;
  const collection = `${database}/users/${encodeURIComponent(
    userId
  )}/favorites`;
  const documentIds = await Promise.all(
    records.map(async (record) => {
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(record.key)
      );
      return Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0")
      ).join("");
    })
  );
  const responseText = await requestJson(
    `https://firestore.googleapis.com/v1/${database}:batchGet`,
    idToken,
    { documents: documentIds.map((id) => `${collection}/${id}`) }
  );
  const remoteByDocumentId = new Map();
  parseJsonResponses(responseText).forEach((response) => {
    if (!response.found) return;
    const documentId = response.found.name.split("/").pop();
    const fields = response.found.fields || {};
    remoteByDocumentId.set(documentId, {
      key: fields.key && fields.key.stringValue,
      fav: !!(fields.fav && fields.fav.booleanValue),
      updatedAt:
        Number(
          fields.updatedAt &&
            (fields.updatedAt.integerValue || fields.updatedAt.doubleValue)
        ) || 0,
    });
  });

  const remoteUpdates = [];
  const writes = [];
  records.forEach((local, index) => {
    const documentId = documentIds[index];
    const remote = remoteByDocumentId.get(documentId);
    if (remote && remote.key === local.key) {
      if (remote.updatedAt >= Number(local.updatedAt))
        remoteUpdates.push(remote);
      else if (local.exists) writes.push({ local, documentId });
    } else if (local.exists) {
      writes.push({ local, documentId });
    }
  });

  if (writes.length) {
    await requestJson(
      `https://firestore.googleapis.com/v1/${database}:commit`,
      idToken,
      {
        writes: writes.map(({ local, documentId }) => ({
          update: {
            name: `${collection}/${documentId}`,
            fields: {
              key: { stringValue: local.key },
              fav: { booleanValue: local.fav },
              updatedAt: {
                integerValue: String(Math.trunc(Number(local.updatedAt))),
              },
            },
          },
        })),
      }
    );
  }
  return {
    downloadedCount: remoteByDocumentId.size,
    uploadedCount: writes.length,
    remoteUpdates,
  };
}

self.addEventListener("message", async (event) => {
  const { id, type, ...request } = event.data || {};
  if (type !== "sync") return;
  try {
    const result = await syncFavorites(request);
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: error.message || String(error) });
  }
});
