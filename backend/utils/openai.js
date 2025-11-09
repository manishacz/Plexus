import "dotenv/config";

const getOpenAIResponse = async (message, images = []) => {
    const content = images.length > 0 
        ? [
            { type: "text", text: message },
            ...images.map(img => ({
                type: "image_url",
                image_url: { url: `data:${img.mimeType};base64,${img.base64}` }
            }))
          ]
        : message;

    const option = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: images.length > 0 ? "gpt-4o" : "gpt-4o-mini",
            messages: [
                {
                    role: "user",
                    content: content
                }
            ],
            max_tokens: 2000
        })
    };

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", option);
        const data = await response.json();
        
        if (!response.ok) {
            console.error("OpenAI API error:", data);
            throw new Error(data.error?.message || "OpenAI API request failed");
        }
        
        return data.choices[0].message.content;
    } catch (error) {
        console.error("Error fetching OpenAI API:", error);
        throw error;
    }
};

export default getOpenAIResponse;
