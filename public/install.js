let deferredInstallPrompt = null;

const installButtons = document.querySelectorAll("[data-install-app]");
const installHelpDialog = document.querySelector("#installHelpDialog");
const installHelpIntro = document.querySelector("#installHelpIntro");
const installHelpSteps = document.querySelector("#installHelpSteps");

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/service-worker.js").catch(() => {}));
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  installButtons.forEach((button) => {
    button.querySelector("span").textContent = "App instalado";
    button.disabled = true;
    button.setAttribute("aria-label", "Aplicativo já instalado");
  });
});

function showInstallInstructions() {
  const userAgent = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(userAgent);
  installHelpSteps.replaceChildren();

  const instructions = isIos
    ? {
        intro: "No Safari, adicione o painel à Tela de Início para abri-lo como aplicativo.",
        steps: ["Toque em Compartilhar, na barra do Safari.", "Escolha Adicionar à Tela de Início.", "Toque em Adicionar para concluir."]
      }
    : isAndroid
      ? {
          intro: "Instale o painel para acessá-lo pela tela inicial do Android.",
          steps: ["Abra o menu do navegador, no canto superior.", "Toque em Instalar app ou Adicionar à tela inicial.", "Confirme a instalação."]
        }
      : {
          intro: "Instale o painel pelo menu do navegador para acessá-lo como aplicativo.",
          steps: ["Abra o menu do navegador.", "Escolha Instalar Vitória Régia ou Instalar app.", "Confirme a instalação."]
        };

  installHelpIntro.textContent = instructions.intro;
  instructions.steps.forEach((step) => {
    const item = document.createElement("li");
    item.textContent = step;
    installHelpSteps.append(item);
  });
  installHelpDialog.showModal();
}

installButtons.forEach((button) => button.addEventListener("click", async () => {
  if (window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true) {
    button.querySelector("span").textContent = "App instalado";
    button.disabled = true;
    return;
  }
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    return;
  }
  showInstallInstructions();
}));

installHelpDialog?.querySelectorAll("[data-close-install-help]").forEach((button) => button.addEventListener("click", () => installHelpDialog.close()));