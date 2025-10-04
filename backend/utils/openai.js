import "dotenv/config";
const getOpenAIResponse = async (message) => {
    const option = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: message
        }
      ]
    })
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", option);
    const data = await response.json();
    // console.log(data.choices[0].message.content);
    return data.choices[0].message.content;
  } catch (error) {
    console.error("Error fetching OpenAI API:", error);
    res.status(500).send("Internal Server Error");
  }
}
export default getOpenAIResponse;
