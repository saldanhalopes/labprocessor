import { Language } from '../types';

export const translations = {
  pt: {
    nav: {
      upload: 'Carregar',
      view: 'Visualizar',
      reagents: 'Materiais',
      charts: 'Gráficos',
      history: 'Histórico',
      settings: 'Parâmetros',
      dashboard: 'Dashboard',
      summary: 'Resumo Geral',
      profile: 'Perfil',
      admin: 'Admin',
      download: 'Baixar CSV',
      logout: 'Sair'
    },
    upload: {
      title: 'Carregar Documentos',
      subtitle: 'Faça upload de métodos analíticos para o banco de dados.',
      dragDrop: 'Arraste e solte seus PDFs aqui',
      clickSelect: 'ou clique para selecionar múltiplos arquivos',
      selectedFiles: 'Arquivos Selecionados',
      processBtn: 'Processar e Salvar',
      processing: 'Processando...',
      info: 'O sistema extrai dados do produto e salva permanentemente no banco de dados local.'
    },
    results: {
      searchPlaceholder: 'Buscar no banco de dados...',
      saveJson: 'Salvar JSON',
      exportCsv: 'Exportar CSV',
      totalTime: 'Tempo de Ciclo (Paralelo)',
      workloadTime: 'Carga Total (Somatória)',
      physChem: 'Físico-Químico',
      micro: 'Microbiologia',
      composition: 'Composição',
      deleteBtn: 'Excluir do Banco',
      deleteConfirm: 'Deseja excluir este método permanentemente do banco de dados?',
      table: {
        test: 'Teste',
        technique: 'Técnica',
        prep: 'Prep (min)',
        run: 'Run (min)',
        calc: 'Calc (min)',
        incub: 'Incub. (min)',
        total: 'Total (h)',
        rationale: 'Racional'
      },
      footer: '* Inclui Locomoção, Setup, Registro e Incubação (apenas para Microbiologia).',
      imagesTitle: 'Imagens Extraídas'
    },
    settings: {
      title: 'Parâmetros de Cálculo',
      dbTitle: 'Gerenciamento de Dados',
      clearDb: 'Limpar Banco de Dados',
      clearDbConfirm: 'ATENÇÃO: Isso excluirá TODOS os métodos salvos. Esta ação não pode ser desfeita. Continuar?',
      successClear: 'Banco de dados limpo com sucesso.',
      saveParams: 'Salvar Parâmetros'
    },
    profile: {
      title: 'Informações Pessoais',
      subtitle: 'Gerencie seus dados de perfil',
      fullName: 'Nome Completo',
      email: 'Email',
      company: 'Empresa',
      role: 'Cargo / Função',
      user: 'Usuário',
      save: 'Salvar Dados',
      securityTitle: 'Segurança',
      securitySubtitle: 'Alterar senha de acesso',
      currentPass: 'Senha Atual',
      newPass: 'Nova Senha',
      confirmPass: 'Confirmar Nova Senha',
      updatePass: 'Atualizar Senha',
      successUpdate: 'Perfil atualizado com sucesso!',
      successPass: 'Senha alterada com sucesso!',
      errorPass: 'Preencha todos os campos.',
      errorMatch: 'As novas senhas não coincidem.',
      errorUser: 'Usuário não encontrado.',
      errorCurrent: 'Senha atual incorreta.'
    },
    admin: {
      title: 'Gerenciamento de Usuários',
      subtitle: 'Administre os usuários do sistema',
      table: {
        user: 'Usuário',
        name: 'Nome',
        email: 'Email',
        role: 'Cargo',
        actions: 'Ações'
      },
      edit: 'Editar',
      delete: 'Excluir',
      save: 'Salvar',
      cancel: 'Cancelar',
      confirmDelete: 'Tem certeza que deseja excluir este usuário?',
      successDelete: 'Usuário excluído com sucesso.',
      successUpdate: 'Usuário atualizado com sucesso.'
    }
  },
  es: {
    nav: {
      upload: 'Cargar',
      view: 'Visualizar',
      reagents: 'Materiales',
      charts: 'Gráficos',
      history: 'Historial',
      settings: 'Parámetros',
      dashboard: 'Dashboard',
      summary: 'Resumen General',
      profile: 'Perfil',
      admin: 'Admin',
      download: 'Descargar CSV',
      logout: 'Salir'
    },
    upload: {
      title: 'Cargar Documentos',
      subtitle: 'Suba métodos analíticos a la base de datos.',
      dragDrop: 'Arrastre y suelte sus archivos PDF aquí',
      clickSelect: 'o haga clic para seleccionar múltiples archivos',
      selectedFiles: 'Archivos Seleccionados',
      processBtn: 'Procesar y Guardar',
      processing: 'Procesando...',
      info: 'El sistema extrae datos y los guarda permanentemente en la base de datos local.'
    },
    results: {
      searchPlaceholder: 'Buscar en la base de datos...',
      saveJson: 'Guardar JSON',
      exportCsv: 'Exportar CSV',
      totalTime: 'Tiempo de Ciclo (Paralelo)',
      workloadTime: 'Carga Total (Sumatoria)',
      physChem: 'Físico-Químico',
      micro: 'Microbiología',
      composition: 'Composición',
      deleteBtn: 'Eliminar de la Base',
      deleteConfirm: '¿Desea eliminar este método permanentemente de la base de datos?',
      table: {
        test: 'Prueba',
        technique: 'Técnica',
        prep: 'Prep (min)',
        run: 'Run (min)',
        calc: 'Calc (min)',
        incub: 'Incub. (min)',
        total: 'Total (h)',
        rationale: 'Racional'
      },
      footer: '* Incluye Locomoción, Setup, Registro e Incubación (solo para Microbiología).',
      imagesTitle: 'Imágenes Extraídas'
    },
    settings: {
      title: 'Parámetros de Cálculo',
      dbTitle: 'Gestión de Datos',
      clearDb: 'Limpiar Base de Datos',
      clearDbConfirm: 'ATENCIÓN: Esto eliminará TODOS los métodos guardados. Esta acción no se puede deshacer. ¿Continuar?',
      successClear: 'Base de datos limpiada con éxito.',
      saveParams: 'Guardar Parámetros'
    },
    profile: {
      title: 'Información Personal',
      subtitle: 'Gestione sus datos de perfil',
      fullName: 'Nombre Completo',
      email: 'Correo Electrónico',
      company: 'Empresa',
      role: 'Cargo / Función',
      user: 'Usuario',
      save: 'Guardar Datos',
      securityTitle: 'Seguridad',
      securitySubtitle: 'Cambiar contraseña de acceso',
      currentPass: 'Contraseña Actual',
      newPass: 'Nueva Contraseña',
      confirmPass: 'Confirmar Nueva Contraseña',
      updatePass: 'Actualizar Contraseña',
      successUpdate: '¡Perfil actualizado con éxito!',
      successPass: '¡Contraseña cambiada con éxito!',
      errorPass: 'Complete todos los campos.',
      errorMatch: 'Las nuevas contraseñas no coinciden.',
      errorUser: 'Usuario no encontrado.',
      errorCurrent: 'Contraseña actual incorrecta.'
    },
    admin: {
      title: 'Gestión de Usuarios',
      subtitle: 'Administre los usuarios del sistema',
      table: {
        user: 'Usuario',
        name: 'Nombre',
        email: 'Correo',
        role: 'Cargo',
        actions: 'Acciones'
      },
      edit: 'Editar',
      delete: 'Eliminar',
      save: 'Guardar',
      cancel: 'Cancelar',
      confirmDelete: '¿Está seguro de que desea eliminar este usuario?',
      successDelete: 'Usuario eliminado con éxito.',
      successUpdate: 'Usuario actualizado con éxito.'
    }
  },
  en: {
    nav: {
      upload: 'Upload',
      view: 'View',
      reagents: 'Materials',
      charts: 'Charts',
      history: 'History',
      settings: 'Parameters',
      dashboard: 'Dashboard',
      summary: 'General Summary',
      profile: 'Profile',
      admin: 'Admin',
      download: 'Download CSV',
      logout: 'Logout'
    },
    upload: {
      title: 'Upload Documents',
      subtitle: 'Upload analytical methods to the database.',
      dragDrop: 'Drag and drop your PDF files here',
      clickSelect: 'or click to select multiple files',
      selectedFiles: 'Selected Files',
      processBtn: 'Process and Save',
      processing: 'Processing...',
      info: 'The system extracts data and saves it permanently to the local database.'
    },
    results: {
      searchPlaceholder: 'Search database...',
      saveJson: 'Save JSON',
      exportCsv: 'Export CSV',
      totalTime: 'Cycle Time (Parallel)',
      workloadTime: 'Total Workload (Sum)',
      physChem: 'Phys-Chem',
      micro: 'Microbiology',
      composition: 'Composition',
      deleteBtn: 'Delete from DB',
      deleteConfirm: 'Do you want to permanently delete this method from the database?',
      table: {
        test: 'Test',
        technique: 'Technique',
        prep: 'Prep (min)',
        run: 'Run (min)',
        calc: 'Calc (min)',
        incub: 'Incub. (min)',
        total: 'Total (h)',
        rationale: 'Rationale'
      },
      footer: '* Includes Locomotion, Setup, Register, and Incubation (Microbiology only).',
      imagesTitle: 'Extracted Images'
    },
    settings: {
      title: 'Calculation Parameters',
      dbTitle: 'Data Management',
      clearDb: 'Clear Database',
      clearDbConfirm: 'WARNING: This will delete ALL saved methods. This action cannot be undone. Continue?',
      successClear: 'Database cleared successfully.',
      saveParams: 'Save Parameters'
    },
    profile: {
      title: 'Personal Information',
      subtitle: 'Manage your profile data',
      fullName: 'Full Name',
      email: 'Email',
      company: 'Company',
      role: 'Role / Position',
      user: 'Username',
      save: 'Save Data',
      securityTitle: 'Security',
      securitySubtitle: 'Change access password',
      currentPass: 'Current Password',
      newPass: 'New Password',
      confirmPass: 'Confirm New Password',
      updatePass: 'Update Password',
      successUpdate: 'Profile updated successfully!',
      successPass: 'Password changed successfully!',
      errorPass: 'Please fill in all fields.',
      errorMatch: 'New passwords do not match.',
      errorUser: 'User not found.',
      errorCurrent: 'Incorrect current password.'
    },
    admin: {
      title: 'User Management',
      subtitle: 'Manage system users',
      table: {
        user: 'Username',
        name: 'Name',
        email: 'Email',
        role: 'Role',
        actions: 'Actions'
      },
      edit: 'Edit',
      delete: 'Delete',
      save: 'Save',
      cancel: 'Cancel',
      confirmDelete: 'Are you sure you want to delete this user?',
      successDelete: 'User deleted successfully.',
      successUpdate: 'User updated successfully.'
    }
  }
};
