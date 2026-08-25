-- CreateTable
CREATE TABLE `Parceiro` (
    `id` VARCHAR(191) NOT NULL,
    `codigo` VARCHAR(32) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Parceiro_codigo_key`(`codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExecucaoIntegracao` (
    `id` VARCHAR(191) NOT NULL,
    `parceiroId` VARCHAR(191) NOT NULL,
    `correlationId` VARCHAR(191) NOT NULL,
    `situacao` ENUM('PENDENTE', 'PROCESSANDO', 'CONCLUIDA', 'FALHA') NOT NULL DEFAULT 'PENDENTE',
    `coletaConcluida` BOOLEAN NOT NULL DEFAULT false,
    `totalRecebidos` INTEGER NOT NULL DEFAULT 0,
    `totalPersistidos` INTEGER NOT NULL DEFAULT 0,
    `totalRejeitados` INTEGER NOT NULL DEFAULT 0,
    `totalFalhas` INTEGER NOT NULL DEFAULT 0,
    `iniciadaEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `concluidaEm` DATETIME(3) NULL,
    `duracaoMs` INTEGER NULL,

    UNIQUE INDEX `ExecucaoIntegracao_correlationId_key`(`correlationId`),
    INDEX `ExecucaoIntegracao_parceiroId_situacao_idx`(`parceiroId`, `situacao`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RegistroIntegracao` (
    `id` VARCHAR(191) NOT NULL,
    `execucaoId` VARCHAR(191) NOT NULL,
    `dividaId` VARCHAR(191) NULL,
    `identificadorExterno` VARCHAR(191) NOT NULL,
    `situacao` ENUM('PENDENTE', 'PERSISTIDO', 'REJEITADO', 'FALHA') NOT NULL DEFAULT 'PENDENTE',
    `motivoRejeicao` TEXT NULL,
    `tentativas` INTEGER NOT NULL DEFAULT 0,
    `payloadBruto` LONGTEXT NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    INDEX `RegistroIntegracao_execucaoId_situacao_idx`(`execucaoId`, `situacao`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Devedor` (
    `id` VARCHAR(191) NOT NULL,
    `documento` VARCHAR(14) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `telefones` JSON NOT NULL,
    `emails` JSON NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Devedor_documento_key`(`documento`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Divida` (
    `id` VARCHAR(191) NOT NULL,
    `devedorId` VARCHAR(191) NOT NULL,
    `parceiroId` VARCHAR(191) NOT NULL,
    `numeroContrato` VARCHAR(191) NOT NULL,
    `valorOriginal` INTEGER NOT NULL,
    `valorAtualizado` INTEGER NOT NULL,
    `dataVencimento` DATETIME(3) NOT NULL,
    `situacao` ENUM('EM_ATRASO', 'EM_NEGOCIACAO', 'QUITADA', 'CANCELADA') NOT NULL DEFAULT 'EM_ATRASO',
    `chaveIdempotencia` VARCHAR(191) NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Divida_chaveIdempotencia_key`(`chaveIdempotencia`),
    INDEX `Divida_parceiroId_situacao_idx`(`parceiroId`, `situacao`),
    INDEX `Divida_dataVencimento_idx`(`dataVencimento`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ExecucaoIntegracao` ADD CONSTRAINT `ExecucaoIntegracao_parceiroId_fkey` FOREIGN KEY (`parceiroId`) REFERENCES `Parceiro`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RegistroIntegracao` ADD CONSTRAINT `RegistroIntegracao_execucaoId_fkey` FOREIGN KEY (`execucaoId`) REFERENCES `ExecucaoIntegracao`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RegistroIntegracao` ADD CONSTRAINT `RegistroIntegracao_dividaId_fkey` FOREIGN KEY (`dividaId`) REFERENCES `Divida`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Divida` ADD CONSTRAINT `Divida_devedorId_fkey` FOREIGN KEY (`devedorId`) REFERENCES `Devedor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Divida` ADD CONSTRAINT `Divida_parceiroId_fkey` FOREIGN KEY (`parceiroId`) REFERENCES `Parceiro`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
