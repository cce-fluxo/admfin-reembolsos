import 'dotenv/config';
import { PipefyService } from '../src/integrations/pipefy/pipefy.service.js';

async function testFetchCard() {
  const pipefyService = new PipefyService();
  
  // O ID do card que causou o problema no log recem postado:
  const targetCardId = 1333269345;
  
  console.log(`Buscando detalhes do card ${targetCardId} no Pipefy...`);
  try {
    const card = await pipefyService.getCardDetails(targetCardId);
    console.log("SUCESSO! O Pipefy respondeu corretamente:");
    console.log(JSON.stringify(card, null, 2));
  } catch (err: any) {
    console.error("FALHA AO BUSCAR CARD NO PIPEFY:", err.message);
  }
}

testFetchCard();
