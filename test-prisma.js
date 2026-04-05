const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const activeCampaigns = await prisma.autoReplyCampaign.findMany({
            where: { isActive: true },
            include: {
                user: { select: { settings: true } }
            }
        });

        console.log("Success:", activeCampaigns);
    } catch (error) {
        console.error("Prisma Error:", error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
