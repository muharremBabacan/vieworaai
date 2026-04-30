async function testLogin() {
  try {
    const res = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyCIyLeBksCYIYDkUdq522hlMnvSKBq3VZw", {
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        returnSecureToken: true,
        email: "admin@viewora.ai",
        password: "123456",
        clientType: "CLIENT_TYPE_WEB"
      }),
      method: "POST"
    });
    const data = await res.json();
    console.log("Response:", JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(e);
  }
}

testLogin();
