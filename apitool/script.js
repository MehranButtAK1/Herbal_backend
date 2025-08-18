document.getElementById("sendBtn").addEventListener("click", async () => {
  const url = document.getElementById("url").value.trim();
  const method = document.getElementById("method").value;
  const bodyInput = document.getElementById("bodyInput").value.trim();
  const adminPassword = document.getElementById("adminPassword").value;

  const output = document.getElementById("responseOutput");
  output.textContent = "⏳ Sending request...";

  let options = { method, headers: { "Content-Type": "application/json" } };

  if (["POST", "PUT", "DELETE"].includes(method)) {
    if (!adminPassword) {
      output.textContent = "❌ Error: Admin password required for " + method;
      return;
    }
    options.headers["x-admin-password"] = adminPassword;
  }

  if (["POST", "PUT"].includes(method) && bodyInput) {
    try {
      options.body = JSON.stringify(JSON.parse(bodyInput));
    } catch (e) {
      output.textContent = "❌ Invalid JSON format in body";
      return;
    }
  }

  try {
    const res = await fetch(url, options);
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    output.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    output.textContent = "⚠️ Request failed: " + err.message;
  }
});
