const nodemailer = require('nodemailer');

/**
 * CleanPro / ViralTrenz Order Processing Function
 * 
 * Logic:
 * 1. Generates a unique, human-readable Order ID.
 * 2. Compiles a beautiful HTML email with the order summary.
 * 3. Sends the email via Nodemailer (SendGrid/SMTP).
 */

// 1. Order ID Generator
function generateOrderId() {
    const prefix = 'ORD';
    const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
    const random = Math.floor(1000 + Math.random() * 9000); // 4-digit random
    return `${prefix}-${timestamp}-${random}`;
}

// 2. HTML Email Template Generator
const generateEmailHtml = (orderId, items, total) => {
    // Generate Item Rows
    const rows = items.map(item => `
        <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px;">
                <img src="${item.image}" width="50" style="border-radius:5px; vertical-align:middle; margin-right: 10px;">
                <strong>${item.title}</strong> <span style="color:#777; font-size:0.9em;">(${item.color})</span>
            </td>
            <td style="padding: 10px; white-space: nowrap;">x ${item.quantity}</td>
            <td style="padding: 10px; white-space: nowrap;">$${(item.price * item.quantity).toFixed(2)}</td>
        </tr>
    `).join('');

    // Full HTML Structure
    return `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e1e4e8; border-radius: 8px; overflow: hidden; color: #333;">
            <div style="background-color: #0fbcf9; padding: 20px; text-align: center; color: white;">
                <h1 style="margin: 0; font-size: 24px;">Order Confirmed!</h1>
            </div>
            
            <div style="padding: 20px;">
                <p style="font-size: 16px; line-height: 1.5;">Hi there,</p>
                <p style="font-size: 16px; line-height: 1.5;">Thank you for shopping with <strong>ViralTrenz</strong>. We have received your order and are getting it ready!</p>
                
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0; text-align: center;">
                    <span style="display: block; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1px;">Order ID</span>
                    <strong style="font-size: 20px; color: #333;">${orderId}</strong>
                </div>

                <h3 style="border-bottom: 2px solid #0fbcf9; padding-bottom: 10px; margin-top: 30px;">Order Summary</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                    <thead>
                        <tr style="background-color: #f1f1f1;">
                            <th style="padding: 10px; text-align: left;">Item</th>
                            <th style="padding: 10px; text-align: left;">Qty</th>
                            <th style="padding: 10px; text-align: left;">Price</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="2" style="padding: 15px; text-align: right; font-weight: bold; border-top: 2px solid #333;">Grand Total</td>
                            <td style="padding: 15px; font-weight: bold; font-size: 18px; border-top: 2px solid #333;">$${total}</td>
                        </tr>
                    </tfoot>
                </table>

                <div style="margin-top: 40px; text-align: center; font-size: 13px; color: #999;">
                    <p>If you have any questions, reply to this email.</p>
                    <p>&copy; ${new Date().getFullYear()} ViralTrenz. All rights reserved.</p>
                </div>
            </div>
        </div>
    `;
};

// 3. Serverless Handler (Vercel/Node style)
module.exports = async (req, res) => {
    // Enable CORS if needed
    // res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.method === 'POST') {
        try {
            const { email, items, total } = req.body;

            // Generate ID
            const orderId = generateOrderId();

            // Configure Transporter (Use Environment Variables in production)
            // Example: SendGrid
            /*
            const transporter = nodemailer.createTransport({
                service: 'SendGrid',
                auth: { user: 'apikey', pass: process.env.SENDGRID_API_KEY }
            });
            */

            // Example: Generic SMTP (Placeholder - needs real credentials)
            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST || 'smtp.example.com',
                port: 587,
                secure: false,
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
            });

            // Send
            const htmlContent = generateEmailHtml(orderId, items, total);

            await transporter.sendMail({
                from: '"ViralTrenz" <orders@viraltrenz.com>',
                to: email, // User's email
                subject: `Order Confirmation ${orderId}`,
                html: htmlContent
            });

            // Success Response
            res.status(200).json({
                success: true,
                orderId: orderId,
                message: 'Order created and email sent'
            });

        } catch (error) {
            console.error('Order Error:', error);
            // Return specific error message for debugging
            res.status(500).json({
                success: false,
                error: error.message || 'Unknown error occurred',
                details: error.toString()
            });
        }
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
};
