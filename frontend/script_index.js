function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    window.location.href = "main.html";
    document.getElementById('userName').textContent = username || "Користувач";
  }
  
  function showForgotPassword(event) {
    event.preventDefault();
    document.getElementById('forgotPasswordBox').classList.remove('hidden');
    document.getElementById('loginBox').classList.add('hidden');
  }
  
  function showRegister(event) {
    event.preventDefault();
    document.getElementById('registerBox').classList.remove('hidden');
  }
  
  function hideModal() {
    document.getElementById('forgotPasswordBox').classList.add('hidden');
    document.getElementById('registerBox').classList.add('hidden');
    document.getElementById('loginBox').classList.remove('hidden');

  }
  
  function resetPassword() {
    const email = document.getElementById('forgotEmail').value;
    alert(`Посилання для скидання паролю відправлено на ${email}`);
    hideModal();
  }
  
  function register() {
    const username = document.getElementById('regUsername').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    alert(`Користувач ${username} зареєстрований з email ${email}`);
    hideModal();
  }