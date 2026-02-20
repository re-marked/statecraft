#!/bin/bash
TOKEN="27ab8e6a92900b57eb2af62154befdbc509d0bbf272e8e01fbeae63ea2f5bf9d"
BASE="http://localhost:3000/api/v1"

for attempt in {1..20}; do
  echo "====== LOOP ATTEMPT $attempt ======"
  
  # Get current state
  STATE=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE/turns/current")
  TURN=$(echo "$STATE" | grep -o '"turn":[0-9]*' | cut -d: -f2)
  PHASE=$(echo "$STATE" | grep -o '"phase":"[^"]*"' | cut -d'"' -f4)
  
  echo "Turn: $TURN | Phase: $PHASE"
  
  # Check if game ended
  if echo "$STATE" | grep -q '"error"'; then
    echo "Game ended!"
    break
  fi
  
  case "$PHASE" in
    "negotiation")
      echo "Submitting generic negotiation..."
      curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
        -d '{"messages":[{"to":"broadcast","content":"France seeks prosperity!","private":false}]}' \
        "$BASE/turns/respond" > /dev/null
      sleep 15
      ;;
    "declaration")
      echo "Submitting minimal declaration..."
      curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
        -d '{"actions":[{"action":"claim_income"},{"action":"neutral"}]}' \
        "$BASE/turns/respond" > /dev/null
      sleep 15
      ;;
    "resolution"|"ultimatum_response")
      sleep 10
      ;;
    *)
      echo "Unknown phase"
      sleep 10
      ;;
  esac
done
