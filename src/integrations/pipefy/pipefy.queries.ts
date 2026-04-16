export const UPDATE_CARD_FIELD_MUTATION = `
  mutation updateCardField($cardId: ID!, $fieldId: ID!, $value: String!) {
    updateCardField(input: {
      card_id: $cardId,
      field_id: $fieldId,
      new_value: $value
    }) {
      card {
        id
      }
    }
  }
`;

export const GET_CARD_DETAILS_QUERY = `
  query getCardDetails($cardId: ID!) {
    card(id: $cardId) {
      id
      title
      fields {
        id
        value
        name
      }
    }
  }
`;
