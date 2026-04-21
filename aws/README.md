# Draft Lobby — AWS WebSocket relay

Minimal CloudFormation stack that hosts a fan-out WebSocket relay for the
Draft Lobby. Designed to fit in the AWS free tier for hobby use.

## What gets created

| Resource                    | Purpose                                                   |
| --------------------------- | --------------------------------------------------------- |
| `AWS::ApiGatewayV2::Api`    | WebSocket API (`wss://…amazonaws.com/<stage>`)            |
| `AWS::Lambda::Function`     | Single Node.js 20 handler for `$connect/$disconnect/$default` |
| `AWS::DynamoDB::Table`      | `(roomId, connectionId)` rows + GSI on `connectionId`, on-demand billing, TTL auto-cleanup |
| `AWS::IAM::Role` (+ policy) | Lambda permissions for DDB and `execute-api:ManageConnections` |
| `AWS::Logs::LogGroup`       | 3-day retention so old logs don't accrue cost             |

Default region/account inferred from your AWS CLI profile. The whole
stack tears down cleanly with `aws cloudformation delete-stack`.

## Deploy

```bash
# 1. Deploy
aws cloudformation deploy \
  --stack-name draft-relay \
  --template-file aws/draft-relay.yaml \
  --capabilities CAPABILITY_IAM \
  --region eu-north-1     # or whichever region is closest to your players

# 2. Read the WebSocket URL out of the stack outputs
aws cloudformation describe-stacks \
  --stack-name draft-relay \
  --region eu-north-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`WebSocketUrl`].OutputValue' \
  --output text
```

The URL looks like `wss://abc123.execute-api.eu-north-1.amazonaws.com/prod`.

## Wiring it into the client

The default URL is hardcoded in `HTML/DraftLobby.html` as `DEFAULT_RELAY_URL`.
Update that constant after deploying a new stack to a different account /
region. Users can also override the URL per-tab in the **Advanced** panel
(persists in `localStorage`) or per-link via `?relay=wss://...`. The host's
share link automatically appends `&relay=...` whenever the URL differs from
the default, so joiners pick up the right relay without extra steps.

The current production deployment is:

```
wss://fu140pmh2c.execute-api.eu-central-1.amazonaws.com/prod
```

## Wire format

A browser opens the socket with the lobby id in the query string:

```js
const ws = new WebSocket(`${RELAY_URL}?lobby=${lobbyId}`);
```

Anything you `ws.send(JSON.stringify(...))` is forwarded to every other
socket currently connected with the same `lobby`. The relay wraps each
forwarded frame so the recipient learns who sent it:

```jsonc
// what client A sends
{ "type": "draftAction", "action": "ban", "category": "faction", "entryId": "Mystic" }

// what clients B/C/... receive
{
  "from": "<A's connectionId>",
  "data": { "type": "draftAction", "action": "ban", "category": "faction", "entryId": "Mystic" }
}
```

A few server-side rules worth knowing:

- `$connect` validates the lobby id with `^[a-z0-9_-]{3,64}$`. Bad/missing
  → connection is refused with HTTP 400.
- The Lambda only fans out to *other* connections in the same lobby — the
  sender never receives an echo of their own message.
- Stale connections are cleaned up two ways: (a) the connection row has
  a TTL (default 4h), and (b) `GoneException` from `postToConnection`
  triggers immediate row removal.
- The first frame the host sends should be a "hello" so other peers learn
  the host's `connectionId` (the relay does not designate a host itself).

## Cost

Everything in the AWS always-free or 12-month-trial tier for typical hobby
use (1k drafts/mo ≈ 100k messages, 60k connection-minutes). After the
trial: roughly $1 per million messages + $0.25 per million connection
minutes for API Gateway WebSocket; DynamoDB on-demand and Lambda stay
effectively free at this volume.

## Tear-down

```bash
aws cloudformation delete-stack --stack-name draft-relay --region eu-north-1
```

DynamoDB table and Lambda log group go with it. No leftover resources.
