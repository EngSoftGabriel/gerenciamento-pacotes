const form = document.querySelector("#loginForm");
const usernameInput = document.querySelector("#username");
const passwordInput = document.querySelector("#password");
const errorMessage = document.querySelector("#loginError");
const submitButton = document.querySelector("#loginSubmit");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorMessage.hidden = true;
  submitButton.disabled = true;
  submitButton.classList.add("loading");

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: usernameInput.value.trim(), password: passwordInput.value })
    });
    if (!response.ok) throw new Error("Usuário ou senha inválidos.");
    window.location.replace("/");
  } catch (error) {
    errorMessage.textContent = error.message || "Não foi possível acessar agora. Tente novamente.";
    errorMessage.hidden = false;
    passwordInput.select();
  } finally {
    submitButton.disabled = false;
    submitButton.classList.remove("loading");
  }
});

document.querySelector("#togglePassword").addEventListener("click", (event) => {
  const button = event.currentTarget;
  const showingPassword = passwordInput.type === "password";
  passwordInput.type = showingPassword ? "text" : "password";
  button.setAttribute("aria-label", showingPassword ? "Ocultar senha" : "Mostrar senha");
  button.title = showingPassword ? "Ocultar senha" : "Mostrar senha";
});