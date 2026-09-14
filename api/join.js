const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch {
      return res.status(400).json({ error: "Invalid JSON" });
    }
  }

  const email = String((body && body.email) || "").trim().toLowerCase();

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: "Please enter a valid email" });
  }

  const apiKey = process.env.EMAILOCTOPUS_API_KEY;
  const listId = process.env.EMAILOCTOPUS_LIST_ID;

  if (!apiKey || !listId) {
    console.error("Missing EmailOctopus env vars");
    return res.status(500).json({ error: "Server is not configured" });
  }

  try {
    const response = await fetch(
      `https://emailoctopus.com/api/1.6/lists/${encodeURIComponent(listId)}/contacts`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          email_address: email,
          status: "SUBSCRIBED"
        })
      }
    );

    const data = await response.json().catch(() => ({}));
    const alreadySubscribed =
      response.status === 400 &&
      JSON.stringify(data).includes("MEMBER_EXISTS_WITH_EMAIL_ADDRESS");

    // New signup OR already on the list → both are a win for the visitor.
    if (response.ok || alreadySubscribed) {
      return res.status(200).json({ ok: true, alreadySubscribed: !!alreadySubscribed });
    }

    console.error("EmailOctopus error:", response.status, data);
    return res.status(502).json({ error: "EmailOctopus rejected the signup" });

  } catch (err) {
    console.error("Waitlist request failed:", err);
    return res.status(502).json({ error: "Unable to reach waitlist service" });
  }
};
