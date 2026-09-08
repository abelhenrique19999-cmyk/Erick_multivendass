# Erick_multivendass

<!DOCTYPE html>
<html lang="pt-BR" class="dark">
<head>
  <meta charset="UTF-8">
  <title>Login Administrativo</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { background-color: #0b0f19; color: #f3f4f6; }
    .glass { background: rgba(17, 24, 39, 0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.1); }
    .gradient-bg { background: linear-gradient(135deg, #8b5cf6, #ec4899); }
  </style>
</head>
<body class="min-h-screen flex items-center justify-center p-4">
  <div class="max-w-md w-full glass p-8 rounded-3xl shadow-2xl">
    <h2 class="text-2xl font-bold text-center mb-6">Painel Administrativo</h2>
    <form id="login-form" class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-400 mb-2">Senha de Acesso</label>
        <input type="password" id="password" required class="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500">
      </div>
      <p id="error-msg" class="text-red-500 text-sm hidden"></p>
      <button type="submit" class="w-full gradient-bg py-3.5 rounded-xl font-bold text-white hover:opacity-90 transition">Entrar</button>
    </form>
  </div>

  <script>
    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const password = document.getElementById('password').value;
      const errorMsg = document.getElementById('error-msg');

      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('admin_token', data.token);
        window.location.href = '/admin/dashboard';
      } else {
        errorMsg.innerText = data.error || 'Erro no login';
        errorMsg.classList.remove('hidden');
      }
    });
  </script>
</body>
</html>
