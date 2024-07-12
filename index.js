const { App } = require('@slack/bolt');
require('dotenv').config();


const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    appToken: process.env.SLACK_APP_TOKEN,
    socketMode: true
});

// app.command('/hello', async ({ command, ack, client }) => {
//     // Acknowledge the command request
//     await ack();
//     await client.chat.postMessage({
//         channel: command.channel_id,
//         text: `Hello <@${command.user_id}>!`,
//         thread_ts: command.ts,  // This will post it in the same thread
//         reply_broadcast: true   // This will make the response visible to everyone in the channel
//     });
// });
  

app.command('/plane', async ({ command, ack, respond, say}) => {
    await ack();
    // Splits the text to store action, board name, and ticket name

    const text = command.text.split(' ')
    const action = text[0]
    const board_name = text[1]
    const ticket_name = text.slice(2).join(' ');

    if (action !== 'maketkt') {
        await respond ({
            text: 'ERROR. Invalid action. To make a ticket, use /plane maketkt [board name] [ticket name].'
        });
        return;
    }

    const projectOptions = {
        method: 'GET',
        headers: {
          'x-api-key': process.env.PLANE_API_TOKEN
        }
    };

    const projectResponse = await fetch('https://pm.speer.io/api/v1/workspaces/speer/projects/', projectOptions);
    const projectData = await projectResponse.json();

    const board = projectData.results.find(board => board.name === board_name);

    if(!board) {
        await respond ({
            text: `ERROR. Board named "${board_name}" not found`
        });
    }
    
    // Checks if there is a label called via Slack
    const labelsResponse = await fetch(`https://pm.speer.io/api/v1/workspaces/speer/projects/${board.id}/labels/`, projectOptions);
    const labelsData = await labelsResponse.json();
    let label = labelsData.results.find(label => label.name === "via Slack");

    // If it does not exist, create one
    if (!label) {
      const createLabelOptions = {
        method: 'POST',
        headers: {
          'x-api-key': process.env.PLANE_API_TOKEN,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: "via Slack",
          color: "#36a64f" 
        })
      };

      const createLabelResponse = await fetch(`https://pm.speer.io/api/v1/workspaces/speer/projects/${board.id}/labels/`, createLabelOptions);
      label = await createLabelResponse.json();
    }

    const labelId = label.id;

    if (ticket_name.trim()) {
        // Defines the request 
        const options = {
            method: 'POST',
            headers: {
                'x-api-key': process.env.PLANE_API_TOKEN,
                'Content-Type': 'application/json'
            },
            // Change body to JSON type
            body: JSON.stringify({
                name: ticket_name,
                labels: [labelId]
            })
        };
          

        try {
            // Sends post request to the URL 
            const response = await fetch(`https://pm.speer.io/api/v1/workspaces/speer/projects/${board.id}/issues/`, options);
            // Converting data into JSON
            const data = await response.json();

            const issueBlock = {
                "blocks": [
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": `The ticket *<https://pm.speer.io/speer/projects/${board.id}/issues/${data.id}|${ticket_name}>* has been successfully created.`
                        }
                    },
                    {
                        "type": "context",
                        "elements": [
                            {
                                "type": "mrkdwn",
                                "text": `*Board:* <https://pm.speer.io/speer/projects/${board.id}/issues/|${board_name}>`
                            }, 
                            {
                                "type": "mrkdwn",
                                "text": "*Status:* In Progress"
                            },
                            {
                                "type": "mrkdwn",
                                "text": `*Assignee:* <@${command.user_id}>`
                            },
                            {
                                "type": "mrkdwn",
                                "text": `*Priority:* ${data.priority} `
                            }
                        ]
                    },
                    {
                        "type": "context",
                        "elements": [
                            {
                                "type": "mrkdwn",
                                "text": "Label *via Slack* has been added to the ticket."
                            }
                        ]
                    }
                ]
            };
            
            await say(issueBlock);

        } catch (error) {
            // Finds error
            console.error(error);
            await respond({
                text: 'ERROR. Failed to create ticket. Please check the input values.'
            });
        }
    } else {
        await respond({
            text: 'ERROR. Please enter a name for the ticket'
        });
        return;
    }
});
  
(async () => {
    await app.start(process.env.PORT || 2000);
    console.log('Hi! The Slack app is running.');
})();

