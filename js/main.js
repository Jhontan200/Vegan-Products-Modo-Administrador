// js/main.js

import { AuthManager } from './authManager.js';

window.togglePassword = function() {
    const passwordInput = document.getElementById('password');
    const eyeOpenIcon = document.getElementById('eye-open');
    const eyeClosedIcon = document.getElementById('eye-closed');
    
    if (passwordInput && eyeOpenIcon && eyeClosedIcon) {
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            eyeOpenIcon.style.display = 'none';
            eyeClosedIcon.style.display = 'block';
        } else {
            passwordInput.type = 'password';
            eyeOpenIcon.style.display = 'block';
            eyeClosedIcon.style.display = 'none';
        }
    }
};

/**
 * Maneja el evento de inicio de sesión al enviar el formulario.
 * Es la función llamada por el onsubmit="handleLogin(event)" en el HTML.
 */
window.handleLogin = async function (event) {
    event.preventDefault(); // Detiene la recarga de la página

    const authManager = new AuthManager();

    // Selectores alineados con los IDs de tu HTML
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('password');
    const submitButton = event.submitter; // El botón que disparó el submit

    const email = emailInput?.value.trim() || "";
    const password = passwordInput?.value.trim() || "";

    // 1. Validaciones
    if (email === "" || password === "") {
        alert("⚠️ No puedes dejar campos vacíos."); return;
    }
    if (!email.includes('@') || !email.includes('.')) {
        alert("⚠️ Ingresa un correo electrónico válido."); return;
    }
    

    // Deshabilitar botón para evitar múltiples envíos
    if (submitButton) submitButton.disabled = true;

    // 2. Intentar autenticación
    const authResult = await authManager.iniciarSesion(email, password);

    if (!authResult.success) {
        if (submitButton) submitButton.disabled = false;
        alert("⚠️ Error: El correo o la contraseña son incorrectos.");
        return;
    }

    // 3. Obtener perfil y verificar rol
    const perfilUsuario = await authManager.getPerfilActual();

    if (!perfilUsuario || perfilUsuario.rol !== 'administrador') {
        // Si no es administrador, cierra la sesión iniciada para denegar el acceso
        await authManager.cerrarSesion();
        if (submitButton) submitButton.disabled = false;
        alert("❌ Acceso denegado. Solo los administradores pueden acceder por esta vía.");
        return;
    }

    // 4. Éxito y Redirección
    localStorage.setItem("usuarioEmail", email);
    localStorage.setItem("usuarioId", perfilUsuario.id);
    localStorage.setItem("usuarioRol", perfilUsuario.rol);

    alert("✅ ¡Inicio de sesión de Administrador exitoso!");
    // 🛑 CAMBIO REALIZADO AQUÍ: Redirigir a administracion.html
    window.location.href = "administracion.html";
}


document.addEventListener("DOMContentLoaded", function () {
    // La función principal handleLogin() está adjunta al evento 'onsubmit' del HTML,
    // por lo que no se necesita un listener adicional aquí.
});