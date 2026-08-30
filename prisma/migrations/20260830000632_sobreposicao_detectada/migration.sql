-- CreateTable
CREATE TABLE `SobreposicaoDetectada` (
    `id` VARCHAR(191) NOT NULL,
    `devedorId` VARCHAR(191) NOT NULL,
    `dividaAId` VARCHAR(191) NOT NULL,
    `dividaBId` VARCHAR(191) NOT NULL,
    `parceiroACodigo` VARCHAR(32) NOT NULL,
    `parceiroBCodigo` VARCHAR(32) NOT NULL,
    `numeroContratoA` VARCHAR(191) NOT NULL,
    `numeroContratoB` VARCHAR(191) NOT NULL,
    `valorAtualizadoA` INTEGER NOT NULL,
    `valorAtualizadoB` INTEGER NOT NULL,
    `detectadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SobreposicaoDetectada_devedorId_idx`(`devedorId`),
    UNIQUE INDEX `SobreposicaoDetectada_dividaAId_dividaBId_key`(`dividaAId`, `dividaBId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SobreposicaoDetectada` ADD CONSTRAINT `SobreposicaoDetectada_devedorId_fkey` FOREIGN KEY (`devedorId`) REFERENCES `Devedor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
