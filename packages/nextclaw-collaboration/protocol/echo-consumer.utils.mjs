let input = "";
for await (const chunk of process.stdin) input += chunk;
const request = JSON.parse(input);
process.stdout.write(JSON.stringify({ text: `Handled by command consumer; continuous context ${request.threadId}` }));
