export type CardFieldUpdatePayload = {
  event: { type: 'card.field_update' };
  data: {
    card: { id: string };
    field: { id: string; value: string };
  };
};

export type CardMovePayload = {
  event: { type: 'card.move' };
  data: {
    card: { 
      id: string; 
      title: string; 
      assignees: Array<{ id: string; name: string; username: string; email: string }> | string[]; 
    };
    from: { id: string; name: string };
    to: { id: string; name: string };
  };
};

export type PipefyWebhookPayload = CardFieldUpdatePayload | CardMovePayload;
