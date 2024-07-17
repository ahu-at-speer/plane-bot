const { App } = require('@slack/bolt');
require('dotenv').config();

const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    appToken: process.env.SLACK_APP_TOKEN,
    socketMode: true
});

app.command('/plane', async ({ command, ack, respond }) => {
    await ack();

    // Splits the text to store action, board name, and ticket name
    const text = command.text.split(' ');
    const action = text[0];
    const board_name = text[1];
    const ticket_name = text.slice(2).join(' ');

    if (action !== 'maketkt') {
        await respond({
            // Ensures only the command invoker sees them
            response_type: 'ephemeral',
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

    console.log("Fetching project data...");
    const projectResponse = await fetch('https://pm.speer.io/api/v1/workspaces/speer/projects/', projectOptions);
    const projectData = await projectResponse.json();

    const board = projectData.results.find(board => board.name === board_name);

    if (!board) {
        await respond({
            response_type: 'ephemeral',
            text: `ERROR. Board named "${board_name}" not found`
        });
        return;
    }

    console.log("Fetching label data...");
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
            console.log("Creating a new ticket...");
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
            console.log("Ticket has been created!");
            await respond({
                // Makes it visible in everyones channel 
                response_type: 'in_channel',
                text: `The ticket *${ticket_name}* has been created.`,
                blocks: issueBlock.blocks
            });

        } catch (error) {
            // Finds error
            console.error(error);
            await respond({
                response_type: 'ephemeral',
                text: 'ERROR. Failed to create ticket.'
            });
        }
    } else {
        await respond({
            response_type: 'ephemeral',
            text: 'ERROR. Please enter a name for the ticket'
        });
    }
});

(async () => {
    await app.start(process.env.PORT || 2000);
    console.log('Hi! The Slack app is running.');
})();