import 'dotenv/config';
import { ContaAzulService } from '../src/integrations/contaazul/contaazul.service.js';

async function testContaAzul() {
  const contaAzul = new ContaAzulService();
  const codigo = "ACE2025/7015";

  console.log(`Buscando no ContaAzul pelo código: ${codigo}...`);
  try {
    const projeto = await contaAzul.getProjectByCodigo(codigo);
    console.log("Sucesso! Encontrado:");
    console.log(JSON.stringify(projeto, null, 2));
  } catch (error: any) {
    console.error("FALHOU no Conta Azul:", error.message || error);
    if (error.response) {
      console.error(await error.response.text().catch(() => ''));
    }
  }
}

testContaAzul();
